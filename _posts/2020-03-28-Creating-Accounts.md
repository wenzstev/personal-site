---
layout: post
title: Creating an Account System
author: Steve
---

Well, I can't put it off any longer. It's time to add the final large feature of this app: the account system. I decided to implement a system for accounts that closely resembles the one implemented in [this](https://www.youtube.com/watch?v=MwZwr5Tvyxo&t=2s) tutorial series, which is what I originally learned to teach myself Flask. I went back through it and reviewed the relevant lessons (plus looked at my example project that I made from those tutorials) to prepare for this implementation.

I started off by creating two new forms, one for registering new accounts, and one for logging in. I saved these in a new `forms.py` folder in my `account` blueprint (which is what I renamed the `user` blueprint).


{% highlight python %}
class RegistrationForm(FlaskForm):
    username = StringField("Username: ", validators=[DataRequired()])
    password = PasswordField("Password: ", validators=[DataRequired()])
    password_confirm = PasswordField("Confirm Password: ", validators=[DataRequired()])
    email = StringField("Email: ", validators=[DataRequired(), Email()])
    submit = SubmitField("Submit")


class LoginForm(FlaskForm):
    username = StringField("Username: ")
    password = PasswordField("Password: ")
    submit = SubmitField("Submit")
{% endhighlight %}

Then, I created a "register" route and a "login" route, using placeholder code for what would happen if the forms actually validated:

{% highlight python %}
account = Blueprint('account', __name__)


@account.register('/register')
@account.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.home'))

    register_form = RegistrationForm()
    if register_form.validate_on_submit():
        flash('Account created successfully!', 'success')
        return redirect(url_for('main.home'))

    return render_template('register.html', register_form=register_form)


@account.route('/login', methods=['GET', 'POST'])
def login():
    login_form = LoginForm()
    if login_form.validate_on_submit():
        flash('You are now logged in!', 'success')
        return redirect(url_for('main.home'))

    return render_template('login.html', login_form=login_form)

{% endhighlight %}

I then created two new links for the navbar, one to register and one to log in:

![alt text](/assets/img/posts/accounts/register-link.png)

Then I wrote the first draft of the template for the register page, which is pretty much just the registration form that I'd already made.

{% highlight html %}
{%raw%}{% extends 'layout.html' %}{%endraw%}

{%raw%}{% block content %}{%endraw%}
<div class="centered-form well">
    <h4> Register a new account to save your Grocery Lists!</h4>
    <hr/>
    <form method="POST" action="">
        {%raw%}{{ register_form.hidden_tag() }}{%endraw%}
        <div class="form-group">
            {%raw%}{{ register_form.username.label(class='form-control-label') }}{%endraw%}
            {%raw%}{{ register_form.username(class='form-control') }}{%endraw%}
        </div>
        <div class="form-group">
            {%raw%}{{ register_form.password.label(class='form-control-label') }}{%endraw%}
            {%raw%}{{ register_form.password(class='form-control') }}{%endraw%}
            <small class="form-text text-muted">Minimum 8 characters, at least one number.</small>
        </div>
        <div class="form-group">
            {%raw%}{{ register_form.password_confirm.label(class='form-control-label') }}{%endraw%}
            {%raw%}{{ register_form.password_confirm(class='form-control') }}{%endraw%}
        </div>
        <div class="form-group">
            {%raw%}{{ register_form.email.label(class='form-control-label') }}{%endraw%}
            {%raw%}{{ register_form.email(class='form-control') }}{%endraw%}
        </div>
        <div class="form-group">
            {%raw%}{{ register_form.submit(class='btn btn-primary') }}{%endraw%}
        </div>
    </form>
</div>
{%raw%}{% endblock content %}{%endraw%}
{% endhighlight %}

I added a small amount of CSS to the `.centered-form` class to center it and keep it a certain size, and the result is a nice clean registration page:

![alt text](/assets/img/posts/accounts/registration-page.png)

I'll spare you the code for the "login" template, as it's essentially the exact same, just with fewer form fields. Here's what it looks like in practice, though:

![alt text](/assets/img/posts/accounts/login-page.png)

Of course, none of these boxes actually do anything because I have no way to create or keep track of users. It's time to change that. I returned to my `models.py` file and created a new database model for users:

{% highlight python %}
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(60), nullable=False)

    def __repr__(self):
        return f"(User('{self.username}', '{self.email}'"
{% endhighlight %}

In following with the original tutorial, I decided to use bcrypt to encrypt the passwords. I wrote in the necessary code in the register and login routes to create a new account and log the user in:

{% highlight python %}
@account.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.home'))

    register_form = RegistrationForm()
    if register_form.validate_on_submit():
        print('here')
        hashed_password = bcrypt.generate_password_hash(register_form.password.data).decode('utf-8')
        user = User(username=register_form.username.data, email=register_form.email.data, password=hashed_password)
        db.session.add(user)
        db.session.commit()
        flash("Account created successfully!", "success")
        return redirect(url_for('main.home'))

    print(register_form.errors)

    return render_template('register.html', register_form=register_form)


@account.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.home'))

    login_form = LoginForm()
    if login_form.validate_on_submit():
        user = User.query.filter_by(username=login_form.username.data).first()
        if user and bcrypt.check_password_hash(user.password, login_form.password.data):
            login_user(user)
            flash('You are now logged in!', 'success')
            return redirect(url_for('main.home'))
        else:
            flash('Login unsuccessful. Please check username and password.', 'danger')

    return render_template('login.html', login_form=login_form)
{% endhighlight %}

Finally, I created a logout route that would log the user out:

{% highlight python %}
@account.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('main.home'))
{% endhighlight %}

Now I had a basic login capability implemented. But I wasn't quite finished with this section; I wanted to provide a little bit more user feedback for if the registration went awry, and I wanted to only show the option to register if no one was logged in.

First, I redesigned the template so that it would only display the options to register/login if the user wasn't logged in, and would display the name of the logged in user. I also added the "Logout" button to the dropdown menu, at the end, and set it to only appear if the user was logged in.

{% highlight html %}
{%raw%}{% if current_user.is_authenticated %}{%endraw%}
    <span class="navbar-text navbar-username">Welcome, {%raw%}{{current_user.username}}{%endraw%}</span>
{%raw%}{% else %}{%endraw%}
    <a class="navbar-brand" href="{%raw%}{{ url_for('account.register') }}{%endraw%}">Register</a>
    <a class="navbar-brand" href="{%raw%}{{ url_for('account.login') }}{%endraw%}">Login</a>
{%raw%}{% endif %}{%endraw%}

<------ in the dropdown ---->
{%raw%}{% if current_user.is_authenticated %}{%endraw%}
    <li><a href="{%raw%}{{ url_for('account.logout') }}{%endraw%}">Logout</a></li>
{%raw%}{% endif %}{%endraw%}
{% endhighlight %}

Here's what the dropdown menu looks like when logged in:

![alt text](/assets/img/posts/accounts/logged-in-menu.png)

Then, I returned to my template pages, and rewrote them so that they would show errors that caused prevented the form from validating:

{% highlight html %}
{%raw%}{% extends 'layout.html' %}{%endraw%}

{%raw%}{% block content %}{%endraw%}
<div class="centered-form well">
    <h4> Register a new account to save your Grocery Lists!</h4>
    <hr/>
    <form method="POST" action="">
        {%raw%}{{ register_form.hidden_tag() }}{%endraw%}
        <div class="form-group">
            {%raw%}{{ register_form.username.label(class='form-control-label') }}{%endraw%}
            {%raw%}{% if register_form.username.errors %}{%endraw%}
            {%raw%}{{ register_form.username(class='form-control is-invalid') }}{%endraw%}
            <div class="invalid-feedback">
                {%raw%}{% for error in register_form.username.errors %}{%endraw%}
                    <span>{%raw%}{{ error }}{%endraw%}</span>
                {%raw%}{% endfor %}{%endraw%}
            </div>
            {%raw%}{% else %}{%endraw%}
                {%raw%}{{ register_form.username(class='form-control') }}{%endraw%}
            {%raw%}{% endif %}{%endraw%}
        </div>
        <div class="form-group">
            {%raw%}{{ register_form.password.label(class='form-control-label') }}{%endraw%}
            {%raw%}{% if register_form.password.errors %}{%endraw%}
            {%raw%}{{ register_form.password(class='form-control is-invalid') }}{%endraw%}
            <div class="invalid-feedback">
                {%raw%}{% for error in register_form.password.errors %}{%endraw%}
                    <span>{%raw%}{{ error }}{%endraw%}</span>
                {%raw%}{% endfor %}{%endraw%}
            </div>
            {%raw%}{% else %}{%endraw%}
                {%raw%}{{ register_form.password(class='form-control') }}{%endraw%}
            {%raw%}{% endif %}{%endraw%}
            <small class="form-text text-muted">Minimum 8 characters, at least one number.</small>
        </div>
        <div class="form-group">
            {%raw%}{{ register_form.password_confirm.label(class='form-control-label') }}{%endraw%}
            {%raw%}{% if register_form.password_confirm.errors %}{%endraw%}
            {%raw%}{{ register_form.password_confirm(class='form-control is-invalid') }}{%endraw%}
            <div class="invalid-feedback">
                {%raw%}{% for error in register_form.password_confirm.errors %}{%endraw%}
                    <span>{%raw%}{{ error }}{%endraw%}</span>
                {%raw%}{% endfor %}{%endraw%}
            </div>
            {%raw%}{% else %}{%endraw%}
                {%raw%}{{ register_form.password_confirm(class='form-control') }}{%endraw%}
            {%raw%}{% endif %}{%endraw%}
        </div>
        <div class="form-group">
            {%raw%}{{ register_form.email.label(class='form-control-label') }}{%endraw%}
            {%raw%}{% if register_form.email.errors %}{%endraw%}
            {%raw%}{{ register_form.email(class='form-control is-invalid') }}{%endraw%}
            <div class="invalid-feedback">
                {%raw%}{% for error in register_form.email.errors %}{%endraw%}
                    <span>{%raw%}{{ error }}{%endraw%}</span>
                {%raw%}{% endfor %}{%endraw%}
            </div>
            {%raw%}{% else %}{%endraw%}
                {%raw%}{{ register_form.email(class='form-control') }}{%endraw%}
            {%raw%}{% endif %}{%endraw%}
        </div>
        <div class="form-group">
            {%raw%}{{ register_form.submit(class='btn btn-primary') }}{%endraw%}
        </div>
    </form>
</div>
{%raw%}{% endblock content %}{%endraw%}
{% endhighlight %}

With the help of a little CSS, this shows the errors for validation nicely:

![alt text](/assets/img/posts/accounts/form-errors.png)

This isn't perfect, though. For example, it can't show database errors, such as what would happen if the user tried to enter in a username that had already been used. To solve that, I returned to my routes and added a try/except block:

{% highlight python %}
if register_form.validate_on_submit():
    print('here')
    hashed_password = bcrypt.generate_password_hash(register_form.password.data).decode('utf-8')
    user = User(username=register_form.username.data, email=register_form.email.data, password=hashed_password)
    try:
        db.session.add(user)
        db.session.commit()
        flash("Account created successfully!", "success")
        login_user(user)
    except exc.IntegrityError as error:
        db.session.rollback()
        flash('Error. Username or email is already in use. Please choose a new one.', 'danger')
        return render_template('register.html', register_form=register_form)

    return redirect(url_for('main.home'))

{% endhighlight %}

This works well enough, although I don't really like that it uses `flash()` for some errors and displays the others underneath the form. That's something I'd like to come back to later, but this post is getting long, and I think I'm going to end it here. I'm updating the github repo for this code, so if you're curious on the details, you can check it out [here](https://github.com/wenzstev/grocerylistapp).

#### Next Steps:
* link each grocery list to an account and make sure that the user can only see their lists
* implement "guest" lists that aren't saved
* user account customization features
