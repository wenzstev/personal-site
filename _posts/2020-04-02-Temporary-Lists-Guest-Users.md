---
layout: post
title: Enabling the Creation of Temporary Lists with Guest Users
author: Steve
---

The creation of user accounts invites a new question: what do we do if someone does not want to make an account? While I could fairly easily arrange it so that a user *must* make an account to use the app, I think it would be better to allow the creation of temporary accounts that allow the creation of just one list. In order to save the list or to create additional lists, the user would have to register, which would upgrade the account into a fully-fledged one. While logged on as a guest user, certain pages and features would not be available.

I decided to implement this by making use of my `User` model, and adding a new line to it to check if an account was "temporary" or not:

{% highlight python %}
# in users class
temporary = db.Column(db.Boolean, default=False)  # determines if user account is temporary (for guest users)
{% endhighlight %}

Designating this as `default=False` ensures that, unless notified otherwise, the model will make all accounts "real." In order to initialize a guest user, I created a new function in my `constructors.py` folder, which assigns random strings to the username, password, and email (since they are all required for an account).

{% highlight python %}
def create_guest_user():
    guest_username = secrets.token_urlsafe(8)
    guest_password = secrets.token_urlsafe(8)
    guest_email = secrets.token_urlsafe(8)

    guest_user = User(username=guest_username, password=guest_password, email=guest_email, temporary=True)
    db.session.add(guest_user)
    db.session.commit()
    return guest_user
{% endhighlight %}

With this created, it was time to add this functionality to the list. I wanted the guest account to be automatically generated if someone tried to create a list when they weren't logged on. To do so, I added a check in my list creation function to determine if a user was logged on. If they were not, it generated a new user and assigned the list to this guest user, like so:


{% highlight python %}
def create_methods(method):
    if current_user.is_authenticated:
        new_list = create_list(current_user.id)
    else:   # we need to create a temporary guest account
        guest_user = create_guest_user()
        login_user(guest_user)
        new_list = create_list(guest_user.id)

  ... # rest of code here
{% endhighlight %}

Also, as a manner of debugging and to see if everything works, I created a small note at the bottom of my `layout.html` to see who is logged in:

{% highlight html %}
{%raw%}{% if current_user.is_authenticated%}{%endraw%}
  <small class="fixed-bottom">Logged in as {%raw%}{{current_user.username}}{%endraw%}</small>
{%raw%}{% endif %}{%endraw%}
{% endhighlight %}

Here you can see an example of a guest account, using the same `secrets.token.token_urlsafe()` function as the rest of my identifiers in this app:

![alt text](/assets/img/posts/guest-accounts/login-info.png)


Now that guest lists existed, it was time to show the difference between them and a regular account. I rewrote parts of the navbar to hide the "My Lists" dropdown and the "Create List" button, and added a "Welcome" line that would refer to the guest as "Guest" if the account was temporary. I also did a bit of work to justify some of the navbar contents to the right.

{% highlight html %}
{%raw%}{% if not current_user.is_authenticated %}{%endraw%}
    <li class="nav-item"><a class="nav-link" href="{%raw%}{{ url_for('account.register') }}{%endraw%}">Register</a></li>
    <li class="nav-item"><a class="nav-link" href="{%raw%}{{ url_for('account.login') }}{%endraw%}">Login</a></li>
{%raw%}{% endif %}{%endraw%}

{%raw%}{% if current_user.is_authenticated %}{%endraw%}
    {%raw%}{% if not current_user.temporary %}{%endraw%}
          {%raw%}{% if grocery_lists %}{%endraw%}
              <li class="nav-item dropdown">
                  <a class="nav-link" data-toggle="dropdown" href="#" role="button">
                      My Lists
                  </a>
                  <div class="dropdown-menu">
                    {%raw%}{% for list in grocery_lists %}{%endraw%}
                      <a class="nav-link dropdown-item" id="link-{%raw%}{{list.hex_name}}{%endraw%}" href="{%raw%}{{url_for('checklist.compiled_list', hex_name=list.hex_name)}}{%endraw%}">{%raw%}{{ list.name }}{%endraw%} ({%raw%}{{ list.hex_name }}{%endraw%})</a>
                          {%raw%}{% endfor %}{%endraw%}
                  </div>
                </li>
                {%raw%}{% endif %}{%endraw%}
                <li class="nav-item"><a class="nav-link" href="{%raw%}{{ url_for('checklist.create_list_page') }}{%endraw%}">Create New List</a></li>
              {%raw%}{% endif %}{%endraw%}
            </ul>
            <ul class="navbar-nav ml-auto">
                <li class="nav-item navbar-text mr-3">Welcome, {%raw%}{{current_user.username if not current_user.temporary else "Guest"}}{%endraw%}</li>
                <li class="nav-item"><a class="nav-link" href="{%raw%}{{ url_for('account.logout') }}{%endraw%}">Logout</a></li>
        {%raw%}{% endif %}{%endraw%}
{% endhighlight %}

A bit later, I went back and added a single link to the guest's account, since I realized that if a different page was clicked, there wouldn't be any way back to the list. I also changed the "Logout" button to a "Register" button:

{% highlight html %}

<li class="nav-item"><a class="nav-link" href="{%raw%}{{ url_for('checklist.compiled_list', hex_name=grocery_lists[0].hex_name) }}{%endraw%}">Your List</a></li>
...
{%raw%}{% if current_user.temporary %}{%endraw%}
    <li class="nav-item"><a class="nav-link" href="{%raw%}{{ url_for('account.register') }}{%endraw%}">Register Account</a></li>
{%raw%}{% else %}{%endraw%}
    <li class="nav-item"><a class="nav-link" href="{%raw%}{{ url_for('account.logout') }}{%endraw%}">Logout</a></li>
{%raw%}{% endif %}{%endraw%}
{% endhighlight %}

This resulted in the following navbar for the guest user:

![alt text](/assets/img/posts/guest-accounts/guest-list-nav.png)

Now, it was time to add the ability to upgrade a guest account to a regular one. I first added a redirect from the homepage to the registration page if the user was a temporary user. Then, on the registration page, I added a check after the user validated the form, which checked if the user was creating an account or was already logged in as a guest. If the user was logged in as a guest, then the username, password, and email of the already existing guest account were changed, rather than a new user being created. This way, I didn't have to migrate the list to a new account.

{% highlight python %}
# in main blueprint
@main.route('/', methods=['GET', 'POST'])
def home():
    if current_user.is_authenticated:
        if not current_user.temporary:
            return redirect(url_for('account.user_homepage'))
        else:
            flash('You are currently logged in as a guest and your account is temporary. Please register a permanent account to save your list and make additional lists!', 'info')
            return redirect(url_for('account.register'))

# in account blueprint
@account.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated and not current_user.temporary:
        return redirect(url_for('main.home'))

    register_form = RegistrationForm()
    if register_form.validate_on_submit():
        print('here')
        hashed_password = bcrypt.generate_password_hash(register_form.password.data).decode('utf-8')
        if not current_user.is_authenticated:
            user = User(username=register_form.username.data, email=register_form.email.data, password=hashed_password)
            db.session.add(user)
        else:
            user = User.query.get(current_user.id)
            user.username = register_form.username.data
            user.email = register_form.email.data
            user.password = hashed_password
            user.temporary = False

{% endhighlight %}

One nice aspect of forcing usernames and emails to be unique is that I can keep most of my `try/except` code that already existed in the registration route:

{% highlight python %}
try:
    db.session.commit()
    flash("Account created successfully!", "success")
except exc.IntegrityError as error:
    db.session.rollback()
    print(error.args)
    flash('Error. Username or email is already in use. Please choose a new one.', 'danger')
    return render_template('register.html', register_form=register_form, grocery_lists=grocery_lists)
{% endhighlight %}

Next, I added a quick `<div>` to the list page to show guests that their list isn't permanent, and encourage them to register an account to save the list.

{% highlight html %}
{%raw%}{% if current_user.temporary %}{%endraw%}
<div>
    <p class="font-italic text-muted">This is a temporary guest list. To make your list permanent (and create additional lists), please
        <a href="{%raw%}{{ url_for('account.register') }}{%endraw%}">register an account.</a>
    </p>
</div>
{%raw%}{% endif %}{%endraw%}
{% endhighlight %}

![alt text](/assets/img/posts/guest-accounts/guest-list-info.png)

That's all very well and good, but there's still one area left: what about deleting temporary accounts? I've thought about this, and I'm not entirely sure I want to. Obviously if space becomes an issue I may change my mind, but the random username and password makes it pretty hard for anyone to get back into a guest account after it's made, and I might want to implement a way for a guest to retrieve a list in the future. If I change my mind, implementing it should be pretty easy; just return and delete all accounts with `temporary` set to true, and delete all lists associated with them. But for now, the temporary accounts can stay in.

#### Next Steps
* "settings" page (with ability to request password reset/change info)
* stricter requirements for passwords (min 8 characters, etc.)
* make sure that a user can only edit their own lists
