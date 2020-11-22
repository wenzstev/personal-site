---
layout: post
title: Second Patch -- Custom Error Pages and the Beginnings of a Control Panel
author: Steve
---

Just a quick note today. I pushed out a second patch a few hours ago, which provides some flashy new custom error pages, which is something that my test users have encountered a disheartening number of times. But that's okay! The fact that I have test users at all is a pretty big accomplishment.

My implementation of the custom pages is extremely simple: I created a new Blueprint called `errors`, where I store all the error handlers for the app. Each handler has an associated html template which informs the user of the problem. There's also a link back to their homepage. For the 404 error:

{% highlight python %}
@errors.app_errorhandler(404)
def error_404(error):
    return render_template('errors/404.html'), 404
{% endhighlight %}

{% highlight html %}
{%raw%}{% extends 'layout.html' %}{%endraw%}

And the html:

{%raw%}{% block content %}{%endraw%}
<div class="card my-4">
    <div class="card-body">
        <h1>404: Page not found.</h1>
        <p>Sorry, the page you're looking for does not exist. </p>
        <p><a href="{{url_for('main.home')}}">Return to your homepage</a></p>
    </div>
</div>
{%raw%}{% endblock content %}{%endraw%}
{% endhighlight %}

And... that's about it for the handlers. Like I said, very barebones and mostly just a way to cover my ass when people crash the program.

Additionally, I created the beginnings of a "control panel" for my app, which proves some admin-style functionality. I wasn't exactly sure how best to implement it securely, so I created a user with a random hex token and saved it as an environment variable. When a client tries to access the control panel page, it checks if the user is that hex pattern (which is my account), and returns a 403 if it isn't.

{% highlight python %}
@account.route("/controlpanel", methods=['GET', 'POST'])
def control_panel():
    if not current_user.is_authenticated:
        abort(403)

    if current_user.username != os.environ.get('ADMIN_USERNAME'):
        abort(403)

    all_users = User.query.all()

    delete_form = DeleteTemporaryForm(prefix="delete-temporary")
    if delete_form.validate_on_submit():
        for user in all_users:
            if user.temporary:
                for list in user.checklists:
                    for cline in list.lines:
                        db.session.delete(cline)
                    for recipe in list.recipes:
                        for raw_line in recipe.lines:
                            db.session.delete(raw_line)
                        db.session.delete(recipe)
                    db.session.delete(list)
                db.session.delete(user)
        db.session.commit()
        flash('Temporary users deleted.', 'success')
        return redirect(url_for('account.control_panel'))


    return render_template("control_panel.html", all_users=all_users, delete_form=delete_form)

{% endhighlight %}

That said, there isn't much you can really do with the admin page right now. I created a simple functionality to delete temporary users, and plan to add some additional features at some point in the future. Mostly, I just wanted a way to easily see who was using the app, and what profiles there were. In that regard, the page works great, and it's super cool to see that a few people (who I've told about it) are indeed making accounts and guest lists.

That's about it for today. Still have a few more issues with the lines to clear up, and then I'm going to put this one to bed for a while. Will probably come back to spruce it up for the portfolio, but for my first project I'm very satisfied. 
