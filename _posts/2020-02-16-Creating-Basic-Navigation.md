---
layout: post
title: Adding Some Navigation to the App
author: Steve
---

Before I went any farther with the functionality of my app, I needed to implement some ability to navigate. So far, there was literally no way to access any of the lists unless you knew the exact hex name (not likely). And besides, I wanted to make it look a bit nicer. It's amazing how much more professional a simple navbar can make a site look. So I decided to start there.

### Navbar

My navbar is essentially taken from the default Bootstrap instructions, with some custom jinja templating to add the list of, ahem, lists.

{% highlight html %}
<nav class="navbar navbar-inverse">
    <div class="container-fluid">
        <div class="navbar-header">
            <button type="button" class="navbar-toggle" data-toggle="collapse" data-target="#myNavbar">
                <span class="icon-bar"></span>
                <span class="icon-bar"></span>
                <span class="icon-bar"></span>
            </button>
            <a class="navbar-brand" href="#">Navbar</a>
        </div>
        <div class="collapse navbar-collapse" id="myNavbar">
            <ul class="nav navbar-nav">
                <li><a href="{%raw%}{{ url_for('main.home')}}{%endraw%}">Home</a></li>
                {%raw%}{% if grocery_lists %}{%endraw%}
                    <li class="dropdown">
                        <a class="dropdown-toggle" data-toggle="dropdown" href="#">My Lists<span class="caret"></span></a>
                        <ul class="dropdown-menu">
                            {%raw%}{% for list in grocery_lists %}{%endraw%}
                                <li><a href="{%raw%}{{url_for('main.compiled_list', hex_name=list.hex_name)}}{%endraw%}">{{ list.name }} ({%raw%}{{ list.hex_name }}{%endraw%})</a></li>
                            {%raw%}{% endfor %}{%endraw%}
                        </ul>
                    </li>
                {%raw%}{% endif %}{%endraw%}
            </ul>
        </div>
    </div>
</nav>
{% endhighlight %}

*(side note: behold, I have discovered the use of the {%raw%}{% raw %}{%endraw%} tag in Liquid. Beautiful stuff)*

All this example does is create a small navbar with the ability to link to the homepage, and display all of the created grocery lists. The `grocery_lists` object is passed in through the route, like so:

{%highlight python%}
grocery_lists = CompiledList.query.all()

return render_template('home.html', title="Welcome!", grocery_lists=grocery_lists, form=form)
{%endhighlight%}

And so on for the other pages. As with everything else on this site, this is still very barebones and has that "default Bootstrap" look that we all love, but I'm just trying to get my bearings here. Note that the 'My Lists' dropdown currently selects all lists; when I implement user functionality, that will change to just the user's lists. But, to use my favorite saying, it'll do for now.

![alt text](/assets/img/posts/app-navbar/dropdown-lists.png)

### Delete

Next it was time to add an option to delete lists. One thing that adding the option to navigate to all lists showed me is that there is a lot of junk in the database that needs to be gotten rid of. First, I created a route for deleting posts:

{% highlight python %}
@main.route('/list/<string:hex_name>/delete', methods=['GET', 'POST'])
def delete(hex_name):
    list_to_delete = CompiledList.query.filter_by(hex_name=hex_name).first_or_404()
    db.session.delete(list_to_delete)
    db.session.commit()
    return redirect(url_for('main.home'))
{% endhighlight %}

As an aside, I probably have enough routes at this point to justify splitting up my blueprint. Something to make note of for a post-to-come.

After creating the route, I needed an option to actually delete on my list page. And because deleting a list is a big deal, I wanted to make sure that the user had the option to confirm the delete, to prevent an accidental deletion. Okay, I admit: this is coming more or less right from the Flask tutorial series I used, but there's no need to reinvent the wheel, and deleting is an important functionality to add.

First, I added a few buttons to the bottom of my list template:

{% highlight html %}
<a type="button" class="btn btn-primary" href="#"> Add Line </a>
<button type="button" class="btn btn-primary" data-toggle="modal" data-target="#addRecipeModal"> Add Recipe </button>
<button type="button" class="btn btn-danger" data-toggle="modal" data-target="#deleteModal"> Delete </button>
{% endhighlight %}

This created a few nice buttons at the bottom of the list:

![alt text](/assets/img/posts/app-navbar/new-list-page.png)

Very pretty, no? Note that the "Add Line" button has no functionality right now, but I want the option to add individual lines as desired, so I just put a nonworking button there as a placeholder. The other two buttons, however, activate modals, both of which use the Bootstrap modal template:

{% highlight html %}
<!-- Modal Delete -->
<div class="modal fade" id="deleteModal" role="dialog" aria-labelledby="deleteModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="deleteModalLabel">Delete List?</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">x</span>
                </button>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to delete this list? All data saved for it will be lost.</p>
            </div>
            <div class="modal-footer">
                <div class="containter-fluid">
                    <div class="pull-left">
                        <form class =col-md-4" action="{%raw%}{{ url_for('main.delete', hex_name=comp_list.hex_name) }}{%endraw%}" method="POST">
                            <input class="btn btn-danger" type="submit" value="Delete">
                        </form>
                    </div>
                    <button type="button" class="btn btn-secondary col-md-4" data-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    </div>
</div>
{% endhighlight %}

When clicked, the modal looks like this:

![alt-text](/assets/img/posts/app-navbar/delete-modal.png)

And deleting is in.

### Adding to an Existing Recipe

Last, but certainly not least, I turned my attention to the "Add Post" button. This is one of the most important aspects of the app; the ability to combine recipes and like ingredients into one list is kind of the whole point, and it's a crucial piece of functionality as I work my way towards feature completeness.

I decided that, at least for now, I was going to use another modal to add a recipe, and have it drop down the same form as is currently on my main page. I'll spare you the HTML and jinja markup, but here's what the modal looks like when clicked:

![alt text](/assets/img/posts/app-navbar/add-recipe-modal.png)

So far so good. Next I was going to have to create a new route for the addition of the recipe. I quickly realized, however, that with a small amount of refactoring, I could reuse much of what I already had, and streamline the process.

Recall that I had originally set up [a cleaning route for new lists]({% post_url 2020-02-15-Adding-to-the-Database %}) using a '/clean' route, with the `hex_name` of the list in question. This was confusing, however, becuase I was using the `hex_name` of the *RecipeList*, not the `CompiledList` that it would later become. This was because, when the cleaning took place, I had not yet created the compiled list that the lines would be added to.

Would it not be simpler to create the compiled list first, and then direct the user to a single "add" route, that I could then reuse any time additional recipes would be added to the list? Yes, I decided. Yes it would.

First, I wrote a new route, taking pieces from the old cleaning route. Note that this route uses the same "/list" route that is for all lists, and incorporates the  `hex_name`s of both the `CompiledList` and the `RecipeList`:

{% highlight python %}
@main.route('/list/<string:list_name>/add/<string:new_recipe>', methods=['GET', 'POST'])
def add_recipe(list_name, new_recipe):
    form = RecipeCleanForm()
    rlist = RecipeList.query.filter_by(hex_name=new_recipe).first_or_404()
    rlist_lines = RawLine.query.filter_by(rlist=rlist).all()

    if form.validate_on_submit():
        current_list = CompiledList.query.filter_by(hex_name=list_name).first_or_404()
        current_list_lines = CleanedLine.query.filter_by(list=current_list).all()

        ingredient_dict = {line.ingredient: line for line in current_list_lines}  # dictionary to make checking if line exists easier

        for line in rlist_lines:
            amount, measurement, ingredient = extract_ingredients(line.text_to_colors)
            if ingredient != '':  # only create cleaned line if we found an ingredient
                if ingredient not in ingredient_dict:
                    cleaned_line = CleanedLine(amount=amount,
                                               measurement=measurement,
                                               ingredient=ingredient,
                                               list=current_list)

                    db.session.add(cleaned_line)
                    db.session.commit()

                    line.cleaned_line = cleaned_line
                    ingredient_dict[ingredient] = cleaned_line
                else:
                    line.cleaned_line = ingredient_dict[ingredient]

        return redirect(url_for('main.compiled_list', hex_name=current_list.hex_name))

    rlist_lines = [LineToPass(line) for line in rlist_lines]

    return render_template('rlist.html', title="Adding Recipe", rlist=rlist, rlist_lines=rlist_lines, form=form)

{% endhighlight %}

You will notice some repeated code from previous routes, but it's all been centralized into this route, making adding more recipes to a `CompiledList` a cinch.

Note also that I used a dictionary object to determine if an ingredient line had already been added. As the app currently exists, repeated ingredients are not added to the list, but a reference is added to that line from the relevant recipe. In the future, I may be consolidating the various amounts from the different ingredient lines (so that, for instance, two recipes each calling for two cups of flour will have four cups on the list), but at the moment I'm not showing amounts at all. They don't quite seem to fit for a grocery list, not exactly. I want the option to exist, but something in me doesn't like someone going to the store with a list that says "4 cups of flour." This is pedantry, I am aware. Sue me.

Next steps:
* make the cleaning page actually work
* increase options for editing the list (Such as adding a single line)
* show more information about the list on the list page

... and plenty more. Stay tuned!
