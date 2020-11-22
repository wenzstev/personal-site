---
layout: post
title: Completing the Custom Recipe Feature
author: Steve
---

After having added the "custom list" functionality in the [last post]({% post_url 2020-03-09-Parse-Backup%}) as a backup for a failed url parse, it was time to add it as an actual feature that the user can access. After all, what if you wanted to use a recipe that wasn't online, or was in a format that couldn't be automatically parsed?

#### A Spot of Refactoring

First, this required a bit of refactoring. I touched on this [a few posts ago]({% post_url 2020-03-06-Fixing-Add-Line %}), but the code that was involved in the creation of a new list and recipe was not packaged in a way that could be easily reused. This wasn't a problem when there was only one way to create a recipe and a list, but now that I'm adding more than one way, we need to generalize this code.

I did so by first splitting the code that creates a recipe and a list, and transferring that code to my `utils.py` file:

{% highlight python %}
# creates a new list
def create_list():
    # create new list
    random_hex = secrets.token_urlsafe(8)
    new_list = CompiledList(hex_name=random_hex)
    db.session.add(new_list)
    db.session.commit()

    # create recipe for user-added lines
    user_added_list = RecipeList(name="Additional Ingredients",
                                 hex_name=secrets.token_urlsafe(8),
                                 hex_color="#D3D3D3",
                                 recipe_url="NA") # FIXME: make recipe_url optional
    user_added_list.complist = new_list
    db.session.add(user_added_list)
    db.session.commit()
    return new_list

# creates a new recipe
def create_recipe(title):
        random_hex = secrets.token_urlsafe(8)
        r = lambda: random.randint(0, 255)
        hex_color = ('#%02X%02X%02X' % (r(), r(), r()))
        rlist = RecipeList(hex_name=random_hex, hex_color=hex_color, name=title, recipe_url="") # FIXME: make recipe_url optional
        db.session.add(rlist)
        db.session.commit()
        return rlist
{% endhighlight %}

Note that my current database model requires a `recipe_url`, and I plan on changing that, but I didn't want to fall down the rabbit hole of database changing just yet.

Then, I split off the code that parsed the recipe from a url into its own function:

{% highlight python %}
def create_recipe_from_url(url):
    rlist = create_recipe(get_title(url))
    rlist.recipe_url = url
    recipe_lines = get_recipe_lines(url)  # TODO: possibly refactor code so that get_recipe_lines is here too
    for num, line in enumerate(recipe_lines):
        recipe_colors = color_entities_in_line(line)
        recipe_line = RawLine(full_text=line, rlist=rlist, id_in_list=num, text_to_colors=recipe_colors)
        db.session.add(recipe_line)
    db.session.commit()

    return rlist   # return the new recipe for use in the route
{% endhighlight %}

By splitting the `create_recipe()` function and then calling it here, I could then create a *second* function to create a recipe from provided text:

{% highlight python %}
def create_recipe_from_text(title, recipe_text):
    recipe = create_recipe(title)
    recipe_lines = recipe_text.splitlines()

    def elim_blanks(line):  # function to remove blank lines and spaces from list
        if not line or line.isspace():
            return False
        else:
            return True

    recipe_lines = filter(elim_blanks, recipe_lines)

    for num, line in enumerate(recipe_lines):  # FIXME: this code is the same as in utils.url_to_recipe
        recipe_colors = color_entities_in_line(line)
        recipe_line = RawLine(full_text=line, rlist=recipe, id_in_list=num, text_to_colors=recipe_colors)
        db.session.add(recipe_line)
    db.session.commit()

    return recipe
{% endhighlight %}

Once this was all finished, the actual code in my `routes.py` to create recipes was drastically simplified. Here's the new backup form:

{% highlight python %}
if not rlist_lines:  # we failed to extract any lines from the recipe
    form = CustomRecipeForm()
    if form.validate_on_submit():
        recipe = create_recipe_from_text("Untitled Recipe", form.recipe_lines.data)
        recipe.name = form.name.data
        return redirect(url_for('main.add_recipe', list_name=list_name, new_recipe=new_recipe))
{% endhighlight %}

With this out of the way, it was time to add the new functionality to the app.

#### Adding the Custom Recipe Option

The first place I wanted to add the feature was in my `home` route. I conceived of this as a second option to start a new list: you could enter in the url, or you could type/paste a list of ingredients. First, I added the `CustomRecipeForm` to the `main.home` route, and wrote the logic for what to do when it was validated. Thanks to the refactoring I did above, this was quite easy:

{% highlight python %}
custom_form = CustomRecipeForm(prefix="custom")
if custom_form.validate_on_submit():
    new_list = create_list()
    new_recipe = create_recipe_from_text("Untitled Recipe", custom_form.recipe_lines.data)
    new_recipe.complist = new_list

    return redirect(url_for('main.add_recipe', list_name=new_list.hex_name, new_recipe=new_recipe.hex_name))
{% endhighlight %}

Behold, the power of refactoring. With just a few lines of code I was able to create a completely new way to initialize a list. All that I needed to do was add the actual form to the template. I put it in the `<jumbotron>` object, below the url form I'd been using thus far:

{% highlight html %}
<p>Or, if you prefer, enter your recipe manually:</p>
<form method="POST" action="">
    {%raw%}{{ custom_form.hidden_tag() }}{%endraw%}
    <div class="form-group">
      {%raw%}{{ custom_form.recipe_lines(class="form-control") }}{%endraw%}
    </div>
    <div class="form-group">
      {%raw%}{{ custom_form.submit(class="btn btn-primary") }}{%endraw%}
    </div>
</form>
{% endhighlight %}

This created a nice, simple new piece of the UI:

![alt text](/assets/img/posts/custom-recipes/add-recipe-main-page.png)

Clicking the "Find Ingredients" button would then redirect the user to the "clean list" page, where the rest of my code would take over.

For my next piece, I wanted to also add the option to paste recipe lines on the actual list page. I again added the form to my `main.compiled_list` route, and thanks to my earlier refactoring, the code was again simple to implement:

{% highlight python %}
 custom_recipe_form = CustomRecipeForm(prefix="custom-recipe")
 if custom_recipe_form.validate_on_submit():
       new_recipe = create_recipe_from_text("Untitled Recipe", custom_recipe_form.recipe_lines.data)
       new_recipe.complist = comp_list

       return redirect(url_for('main.add_recipe', list_name=comp_list.hex_name, new_recipe=new_recipe.hex_name))
{% endhighlight %}

I have to be totally honest here: I'm pretty proud of how easy it was to implement these features. It shows that I've structured my code well and that the refactoring was a positive use of my time. I don't want to pat myself on the back *too* much (who the hell knows if this is even that impressive, tbh), but dammit I'm proud.

Anyway, horn-tooting aside, I still needed to add these features to the `list_page.html` template. Following my lead from the homepage, I added it to the already existing modal that was being used to paste a new url:

{% highlight html %}
<p>Or paste/type the Recipe Ingredients below:</p>
<form method="POST" action="">
  {%raw%}{{ custom_recipe_form.hidden_tag() }}{%endraw%}
  <div class="form-group">
      {%raw%}{{ custom_recipe_form.recipe_lines(class="form-control") }}{%endraw%}
  </div>
  <div class="form-group">
      {%raw%}{{ custom_recipe_form.submit(class="btn btn-primary") }}{%endraw%}
  </div>
</form>
{% endhighlight %}

Checked the modal and it all works:

![alt text](/assets/img/posts/custom-recipes/add-recipe-modal.png)

I pasted in a few recipes, just to make sure everything was working, and so far so good.

Next steps:
* ability to export the list to print/email
* increased list functionality (delete lines, temporarily cancel them out)
* move lines around?

... and plenty more. At this point I'm beginning to realize that I need a roadmap to figure out when I can call this thing "feature complete." I have a *ton* of ideas, but I want to have a "v1.0" out first, with a certain bare minimum functionality, before I chase after some more of my more involved ideas. So expect a roadmap post coming in the near future. 
