---
layout: post
title: List Copies and Edit Restrictions
author: Steve
---

There are two last areas that I wanted to add to my app before I could move on to the bugfixing stage. First, I wanted to prevent people who weren't owners of the list from making edits to the list. Second, I wanted to provide the option to create a copy of the list, so that a user could have their own copy to edit and add to.

The first of these issues was easy. The second, less so.

### Restricting Editing Access

In order to prevent non-owners from editing a list, the program first has to know if the owner is the one editing the list. I achieved this with a very simple check between the `id` of the `current_user` and the `user_id` of the list. I also included the creator of the list in the template, under the variable `creator`.

{% highlight python %}
user_is_owner = current_user.id == comp_list.user_id
creator = current_user if user_is_owner else User.query.get(comp_list.user_id)
{% endhighlight %}

Then, I passed this information in, and simply added a number of template checks that would prevent certain buttons and features from being displayed. For example, to prevent the `Add Recipe` button from appearing, I wrote the following:

{% highlight html %}
{%raw%}{% if user_is_owner %}{%endraw%}
<button type="button" class="btn btn-primary" data-toggle="modal" data-target="#addRecipeModal"> Add Recipe </button>
{%raw%}{% endif %}{%endraw%}
{% endhighlight %}

For other buttons, such as the drag marker and the checkbox, were disabled:

{% highlight html %}
<input id="checkbox-{%raw%}{{line.hex_id}}{%endraw%}" type="checkbox"{%raw%}{{line.checked}}{% if not user_is_owner%}{%endraw%}disabled{%raw%}{% endif %}{%endraw%}>
{% endhighlight %}

I also added a new button to create a copy, and set it to appear if the list was *not* the user's:

{% highlight html %}
{%raw%}{% if not user_is_owner %}{%endraw%}
<a href="{%raw%}{{url_for('checklist.copy_list', hex_name=comp_list.hex_name)}}{%endraw%}" class="btn btn-success">Create Copy</a>
{%raw%}{% endif %}{%endraw%}
{% endhighlight %}

*Note: At this point, I hadn't created the route to `checklist.copy_list`.*

Finally, I created a small subtext to show the original creator underneath the list name:

{% highlight html %}
{%raw%}{% if not user_is_owner %}{%endraw%}
<div>
    <p class="font-italic text-muted">Created by {%raw%}{{creator.username}}{%endraw%}</p>
</div>
{%raw%}{% endif %}{%endraw%}
{% endhighlight %}

Taken together, this showed a slightly different version of the list to someone who hadn't created it, which is exactly what I wanted.

![alt text](/assets/img/posts/list-copies/list-not-owner.png)

Of course, just restricting access like that isn't enough. The routes still exist; a savvy person could still make changes by altering the routes or sending POST data. For example, simply typing "/delete" at the end of a list would delete it, no matter who originally owned it!

To solve this, I needed to create actual checks in the code. I decided that the best way to do so would be to use a decorator (which, incidentally, gave me an excuse to look up and learn how decorators work). I wrote a decorator called `owner_only` which retrieves the list in question (either from the variable or in the POST data) and compares it to the current user. If they match, great! If not, then we return a 403 Forbidden code.

{% highlight python %}
def owner_only(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        current_list = CompiledList.query.filter_by(hex_name=kwargs.get('hex_name', '')).first()
        if not current_list:
            # try to get from form
            current_list = CompiledList.query.filter_by(hex_name=request.form.get('list', '', type=str)).first_or_404()
        if not current_list:
            # this shouldn't happen
            return abort(500)
        if current_list.user_id != current_user.id:
            return abort(403)

        return func(*args, ** kwargs)
    return wrapper
{% endhighlight %}

The nice thing about using a decorator this way is that I can just add it underneath the existing route decorators on any route that is restricted to only being used by the owner of the list. For example, here's the decorator on the `delete()` route:

{% highlight python %}
@checklist.route('/list/<string:hex_name>/delete', methods=['GET', 'POST'])
@owner_only
def delete(hex_name):
    list_to_delete = CompiledList.query.filter_by(hex_name=hex_name).first_or_404()
    db.session.delete(list_to_delete)
    db.session.commit()
    return redirect(url_for('main.home'))
{% endhighlight %}

And that's it! There are now checks in place that prevent certain functions of the list from being accessed by anyone who didn't create the list. Satisfied with my implementation, I turned to what I thought would be a simple, even trivial addition: the ability to copy a list.

How little did I know.

### Copying the List

First, I sifted around and searched for existing ways to copy database rows with SQLAlchemy. I came across [this](https://www.atemon.com/blog/clone-a-sqlalchemy-db-object-with-new-primary-key/), which (from what I understand), essentially detaches the database row from the session, resets it to its state of initial creation (that's the `make_transient()` call), changes what needs to be changed, and then reinserts it with a `None` id attribute, triggering the database to assign a new id. Even though it's never technically "copied," the end result is the same. At least, that's my understanding; to be honest I'm still a bit weak on databases.

Of course, it was going to be a bit more complicated than that, because I didn't just need to copy a single row, but an entire interlocked network of rows from several different models. This resulted in several tricky bugs that took me a while to work out.

I started by copying the `CompiledList` model, which was the easiest:

{% highlight python %}
@checklist.route('/list/<string:hex_name>/copy')
def copy_list(hex_name):
    list_to_copy = CompiledList.query.filter_by(hex_name=hex_name).first_or_404()

    db.session.expunge(list_to_copy)
    make_transient(list_to_copy)

    list_to_copy.name = f'Copy of {list_to_copy.name}'
    list_to_copy.id = None
    list_to_copy.user_id = current_user.id
    list_to_copy.hex_name = secrets.token_urlsafe(8)

    db.session.add(list_to_copy)
    db.session.commit()
{% endhighlight %}

This worked essentially exactly as how the blog post explained it would, although since the individual lines in the list weren't loaded too, it simply copied an empty list. But no worries, that's what I expected.

I then tried to copy the list of recipes, and it was here that I ran into my first real problem. I began to get errors where null constraints were failing; i.e., the database was attempting to insert null values into areas where actual information was required. This wasn't supposed to happen, because, according to the above post, the object, once detached, should have retained all of its attributes.

Curious as to where the item was losing its attributes, I added some printing requests to debug, and the plot thickened: when printing the object, not only did the attributes print fine, but the error vanished as well!

This had me *really* scratching my head, as I'd never encountered an error that could be fixed just by debugging. It took me a fair amount of fruitless searching before I figured out the issue from [this](https://stackoverflow.com/questions/3039567/sqlalchemy-detachedinstanceerror-with-regular-attribute-not-a-relation) StackOverflow problem, which linked me to [this](https://www.mail-archive.com/sqlalchemy@googlegroups.com/msg13278.html) thread. Turns out, the objects weren't fully loading when the database was first queried, because they didn't need to be; they could be loaded when a specific attribute was requested. Normally this wouldn't be a problem, but detaching the object from the session meant that it no longer had access to the database and couldn't query the objects. However, calling a `print()` command beforehand forced the database to load the object to print it, so it was still stored in memory when it was detached, resolving the issue.

My solution was to use a `session.refresh()` call before detaching, which queried the database and essentially forces the object to load all of its attributes. This results in a significantly increased number of database queries, but at that point I was just trying to get it out. If numerous users becomes an issue, I'll work on establishing a [session.expire_on_commit()](https://stackoverflow.com/questions/51446322/flask-sqlalchemy-set-expire-on-commit-false-only-for-current-session/51452451) solution.

With the working refresh, I set to copying the rest of the grocery list structure, iterating through each Recipe, then line, then cleaned line:

{% highlight python %}
@checklist.route('/list/<string:hex_name>/copy')
def copy_list(hex_name):
    list_to_copy = CompiledList.query.filter_by(hex_name=hex_name).first_or_404()
    recipes_to_copy = RecipeList.query.filter_by(complist=list_to_copy).all()

    db.session.expunge(list_to_copy)
    make_transient(list_to_copy)

    list_to_copy.name = f'Copy of {list_to_copy.name}'
    list_to_copy.id = None
    list_to_copy.user_id = current_user.id
    list_to_copy.hex_name = secrets.token_urlsafe(8)

    db.session.add(list_to_copy)
    db.session.commit()

    for recipe in recipes_to_copy:
        print('Old ID: ', recipe.id)
        recipe_lines = RawLine.query.filter_by(rlist=recipe).all()

        db.session.refresh(recipe)  # do this to make sure that all attributes are loaded
        db.session.expunge(recipe)

        make_transient(recipe)

        recipe.complist = list_to_copy
        recipe.id = None
        recipe.hex_name = secrets.token_urlsafe(8)

        db.session.add(recipe)
        db.session.commit()
        print("New ID: ", recipe.id)

        for line in recipe_lines:
            cleaned_line = CleanedLine.query.get(line.cline_id)
            print(cleaned_line)

            db.session.refresh(line)
            db.session.expunge(line)
            make_transient(line)

            line.id = None
            line.list_id = recipe.id

            db.session.add(line)
            db.session.commit()
            print("Line ID: ", line.id)

            print(cleaned_line)

            if cleaned_line:    # recipe line might not have a list item associated
                    db.session.refresh(cleaned_line)
                    db.session.expunge(cleaned_line)
                    make_transient(cleaned_line)

                    cleaned_line.id = None
                    cleaned_line.hex_id = None
                    cleaned_line.list = list_to_copy

                    db.session.add(cleaned_line)
                    db.session.commit()
                    line.cline_id = cleaned_line.id


    return redirect(url_for('checklist.compiled_list', hex_name=list_to_copy.hex_name))

{% endhighlight %}

This worked fairly well, but messed up in a few specific case instances, most notably when there was more than one `RawLine` that pointed to the same `CleanedLine`. In those cases, each `RawLine` produced its own `CleanedLine`, resulting in doubled lines. I solved this by first checking to see if a `CleanedLine` already existed for the given ingredient, and tying the `RawLine` to that line if so. Here's rewrite of the last `if` statement above:

{% highlight python %}
if cleaned_line:    # recipe line might not have a list item associated
    existing_line = CleanedLine.query.filter_by(ingredient=cleaned_line.ingredient, list=list_to_copy).first()
    if not existing_line:
        db.session.refresh(cleaned_line)
        db.session.expunge(cleaned_line)
        make_transient(cleaned_line)

        cleaned_line.id = None
        cleaned_line.hex_id = None
        cleaned_line.list = list_to_copy

        db.session.add(cleaned_line)
        db.session.commit()
        line.cline_id = cleaned_line.id
    else:
        line.cline_id = existing_line.id
{% endhighlight %}

This was successful, and my list copied properly.

![alt text](/assets/img/posts/list-copies/list-copied.png)

With this, I am saying that my app is officially feature complete! At least for version 1.0. There are still a lot of bugfixes to make, but essentially all of the functionality that I wanted for the first release is in. And while it seems unlikely that I'm going to get it out in two days (April 9 was my original desired date), I'm hopeful that another week or so of bugfixing will get it to the point where I can host.

#### Next Steps
* bugfixing, bugfixing, bugfixing
* making it look a bit prettier
