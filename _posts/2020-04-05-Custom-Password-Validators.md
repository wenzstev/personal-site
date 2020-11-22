---
layout: post
title: Custom Validators and Verifying Email
author: Steve
---

Today I took care of a couple of odds and ends regarding the user system: the need to have stricter password validators, and the need to verify an email address.

First off, the validators. I wanted to have additional requirements for the password, such as requiring a number and requiring a digit. I consulted the WTForms documentation on [validators](https://wtforms.readthedocs.io/en/stable/validators.html), which also invited a side glance into the [Factory Method](https://realpython.com/factory-method-python/). This is something I'm going to be looking at when I have to improve my recipe scraper. But that's for another post.

My first version of the validator was a bit cumbersome, but worked as proof of concept:

{% highlight python %}
class PasswordValidate:
    def __init__(self, min=-1, max=-1, needs_num=True, needs_sym=True, message=None):
        self.min = min
        self.max = max
        self.needs_num = needs_num
        self.needs_sym = needs_sym

        self.acceptable_syms = {'!', '@', '#', '$', '%', '^', '&', '* ', '-', '+', '+', '_ ','/', '|', '~', '?'}

        if not message:
            message = f'''Password must be between {min} and {max} characters long. '''
            if needs_num:
                message += "Password must have at least one number. "
            if needs_sym:
                message += "Password must have at least one symbol. "
        self.message = message

    def __call__(self, form, field):
        length = field.data and len(field.data) or 0
        if length < self.min or self.max != -1 and length > self.max:
            raise ValidationError(self.message)
        if self.needs_num and not any(char.isdigit() for char in field.data):
            raise ValidationError(self.message)
        if self.needs_sym and not any(sym in field.data for sym in self.acceptable_syms):
            raise ValidationError(self.message)
{% endhighlight %}

It's essentially an expanded version of the example given on the WTForms documentation, with the use of several `any()` calls to check if there was a digit or an acceptable symbol. I tried it and it seemed to work when I gave it bad information:

![alt text](/assets/img/posts/settings-and-passwords/password-validate-custom.png)

It's too cumbersome, though. It can tell if something is wrong, but doesn't give the user feedback on which of the three issues (length, digit, symbol) is the problem. What I really needed to do was create several different validators.

I decided to use the already existing `Length` validator for my length, and split the rest of the code into two new validators: `DigitRequired` and `SymbolRequired`:

{% highlight python %}
class DigitRequired:
    def __init__(self, message=None):
        if not message:
            message = "You must include at least one number."
        self.message = message

    def __call__(self, form, field):
        if not any(char.isdigit() for char in field.data):
            raise ValidationError(self.message)


class SymbolRequired:
    def __init__(self, message=None, accepted_syms=None):
        if not accepted_syms:
            accepted_syms = {'!', '@', '#', '$', '%', '^', '&', '* ', '-', '+', '+', '_ ', '|', '~', '?'}
        self.accepted_syms = accepted_syms

        if not message:
            message = f"You must include at least one of the following symbols: {', '.join(self.accepted_syms)}."
        self.message = message

    def __call__(self, form, field):
        if not any(sym in field.data for sym in self.accepted_syms):
            raise ValidationError(self.message)

{% endhighlight %}

Then, because all these validators would be clumped up anyway, I created a list with all of the validators for passwords, called `PasswordValidators`:

{% highlight python %}
PasswordValidators = [DataRequired(), SymbolRequired(), DigitRequired(), Length(min=8, max=20)]
{% endhighlight %}

This made it very easy to simply put the password validators in wherever I needed them:

{% highlight python %}
class RegistrationForm(FlaskForm):
    ...
    password = PasswordField("Password: ", validators=PasswordValidators)
    ...

class ChangePasswordForm(FlaskForm):
        ...
        new_password = PasswordField('New Password', validators=PasswordValidators)
        ...

class ResetPasswordForm(FlaskForm):
        password = PasswordField('Password', validators=PasswordValidators)
        ...
{% endhighlight %}

Done. I gave it a few simple tests and everything seemed to be working. That was easy. On to the next issue.

### Validating Email Addresses

Most apps with a user account system require the user to verify their email address before sending them anything important, such as a request to change their password. I wanted to implement this feature as well, and since I already had something similar implemented for the reset password, I figured it would be pretty simple.

First, I created a new line in my `Users` model to check if their email is validated:

{% highlight python %}
class User(db.Model, UserMixin):
    ...
    email_validated = db.Column(db.Boolean, default=False)
    ...
{% endhighlight %}

Then, while still in the `User` class, I created new methods to generate an email verify token, and to check that token. Originally I used the same validators from my password changer, but I didn't want this link to be time-sensitive, so I ultimately added new ones. In the future, however, I think it would be a good idea to combine these (maybe with a factory method?), since there's too much repetition going on.

{% highlight python %}
# TODO: combine this with get_reset_token
def get_validate_token(self):
    s = Serializer(current_app.config['SECRET_KEY'])
    return s.dumps({'user_id': self.id}).decode('utf-8')

# TODO: combine this with verify_reset_token
@staticmethod
def verify_email_token(token):
    s = Serializer(current_app.config['SECRET_KEY'])
    try:
        user_id = s.loads(token)['user_id']
    except:
        return None

    return User.query.get(user_id)
{% endhighlight %}

Then, I created a new funciton to generate the email to send to validate the address, and made sure to send it when the user first registered their account:

{% highlight python %}
# in accounts.utils.py
def send_validate_email(user):
    token = user.get_validate_token()
    msg = Message('Verify Your Email', sender='groceryapp5@gmail.com', recipients=[user.email])
    msg.body = f'''To verify your email, please visit this link:
                    {url_for('account.verify_email', token=token, _ external=True)}.
                    Please note: if you do not verify your email, you will be unable to reset your password.'''
    mail.send(msg)

# in accounts.routes.py
@account.route('/register', methods=['GET', 'POST'])
def register():
    ...
    if register_form.validate_on_submit():
        ...
        try:
            db.session.commit()
            flash("Account created successfully!", "success")
            send_validate_email(user)
        ...
{% endhighlight %}

Then, I wrote in a new route to validate the token. It retrieves the User's `id` from the token and changes that user's `email_verified` bool to true. Thus, the email is verified.

{% highlight python %}
@account.route("/verify_email/<token>")
def verify_email(token):
    user = User.verify_email_token(token)
    if not user:
        flash('This is an invalid validate request.', 'warning')
        return redirect(url_for('main.home'))
    user.email_validated = True
    db.session.commit()
    flash(f'The email account {user.email} has been validated!', 'success')
    return redirect(url_for('main.home'))
{% endhighlight %}

Finally, I added a check in my `reset_password` route to see if the user's email was verified. If it was not, then it does not send a link to change the password. This might make it tricky for people who don't verify their emails to change their password, but I might add in a secondary option at some point.

{% highlight python %}
@account.route("/reset_password", methods=['GET', 'POST'])
def reset_request():
...
    if reset_form.validate_on_submit():
        user = User.query.filter_by(email=reset_form.email.data).first()
        ...
        if not user.email_verified:
            flash('This user does not have a verified email address.', 'danger')
            return redirect(url_for('account.reset_request'))
        ...
{% endhighlight %}

And done! Two important additions to my user functionality. We're almost done here.

#### Next Steps
* can only edit own lists
* copy user lists
* begin debugging 
