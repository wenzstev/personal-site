---
layout: post
title: Adding a Link to the Recipe Source
author: Steve
---

Next up on my list was the creation of a link to the recipe source for each recipe (provided the recipe came from a URL). I wanted to do this to provide a quick and easy way for the user to navigate to their desired recipe, and to allow the list to double as a place to store said recipes.

First, I went into the list template page and added a new `<a>` tag to each `.recipe-button` line. In doing so, I also adjusted a few other features in the area, changing the `.recipe-button` to a `<div>` to avoid nested buttons, and adding some CSS to make everything look decent. Here's what I came up with first:

![alt text](/assets/img/posts/recipe-source/first-source.png)

...and the associated html:

{% highlight html %}
<div class="col-sm-6">
 <h1> Recipes </h1>
  <div id="recipe-list" class="list-group">
   {%raw%}{% for recipe in recipe_list %}{%endraw%}
     <div role="button" class="recipe-button list-group-item">
     <span class="dot hidden {%raw%}{{recipe.hex_color}}{%endraw%}" style="background-color:{%raw%}{{recipe.hex_color}}{%endraw%}"></span>
     {%raw%}{{recipe.name}}{%endraw%}
     {%raw%}{% if recipe.recipe_url %}{%endraw%}
      <a href={%raw%}{{recipe.recipe_url}}{%endraw%} target="_ blank" class="source-button well">Source</a>
     {%raw%}{% endif %}{%endraw%}
     </div>
   {%raw%}{% endfor %}{%endraw%}
  </div>
  <button type="button" class="btn btn-primary" data-toggle="modal" data-target="#addRecipeModal"> Add Recipe </button>
</div>
{% endhighlight %}

...and the CSS:

{% highlight css %}

#recipe-list .recipe-button:hover{
  background-color: whitesmoke;
}

...

.source-button {
  float: right;
  background-color: darkgray;
  color: white;
  padding: 3px;
  position: relative;
  bottom: 2px;
  left: 10px;
  margin: 0px;
}

.source-button:hover{
  text-decoration: none;
  background-color: gray;
  color: white;
}

.source-button:focus{
  text-decoration: none;
  color: white;
}
{% endhighlight %}

This was all extremely easy, and in no time I had a functioning button that took the user to the necessary page. I then went into the code and made some quick alterations so that the "Additional Ingredients" recipe didn't have any url associated with it (previously, it received a url of "NA"). Then, because I'm a bit of a stickler, I went into the list code and reversed the list of recipes before they're passed to the template, which ensured that the "Additional Ingredients" recipe was always at the end of the list. I also liked this because it meant that the most recently added recipe would rise to the top of the list. You can actually already see that implemented in the above picture, since I forgot to take screenshots while coding.

And that's just about it for today! Although I do want to talk about an error that I accidentally found while going through the code to make sure that, when the recipe parser couldn't parse the necessary recipes, it defaulted to asking the user to paste/type in the recipe lines. Turns out I'd messed up a fairly vital piece of the code, and as a consequence, it became stuck in an endless loop where it was forever unable to parse the code. It was a fairly simple fix when I figured out what was going on, and I added in a quick feature to make sure that, when defaulting to the copy/paste feature, the program still remembered that the recipe had originally come from a url:

{% highlight python %}
@main.route('/list/<string:list_name>/add/<string:new_recipe>', methods=['GET', 'POST'])
def add_recipe(list_name, new_recipe):
    rlist = RecipeList.query.filter_by(hex_name=new_recipe).first_or_404()
    rlist_lines = RawLine.query.filter_by(rlist=rlist).all()


    if not rlist_lines:  # we failed to extract any lines from the recipe
        form = CustomRecipeForm()
        if form.validate_on_submit():
            print('checking recipe')
            recipe = create_recipe_from_text("Untitled Recipe", form.recipe_lines.data)
            recipe.name = form.name.data
            recipe.recipe_url = rlist.recipe_url
            db.session.commit()
            db.session.delete(rlist)
            return redirect(url_for('main.add_recipe', list_name=list_name, new_recipe=recipe.hex_name))

{% endhighlight %}

Finally, below you can see an example of the source button working with multiple recipes, including one (Additional Ingredients) where there isn't a source. Note that the colors for "Low-Carb Salisbury Steak" and "Pecan Sour Cream Coffee" are really similar. That was random and I do wonder if there's a way to make it less likely.

![alt text](/assets/img/posts/recipe-source/final-source.png)

#### Next Steps
* Ability to print list,
* Ability to email list,
* Ability to text list?
