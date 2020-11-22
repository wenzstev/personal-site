---
layout: post
title: What Happens When We Can't Parse a Recipe
author: Steve
---

Now that the basic functionality of cleaning and adding new lines is working successfully, it's time to expand the options a user has to make use of those features. The first way I want to do that is to give the user the ability to add custom recipes. Additionally, I want this ability to function as a fallback, in case the program fails to properly parse the recipe from the urls (which happens *a lot* right now, although to be fair I haven't touched that part of the program in a long time). Seeing as this functionality can effectively kill two birds with one stone, I decided that I was going to implement it next.

First, I created a new form in my `forms.py` file, consisting of a `<textarea>` tag that would enable multi-line entering of a recipe:

{% highlight python %}
class CustomRecipeForm(FlaskForm):
    name = StringField("Name:")
    recipe_lines = TextAreaField("Ingredients:")
    submit = SubmitField("Submit")
{% endhighlight %}

Then, I created a new `html` template for users who want to enter in a manual recipe. This template will also double as the fallback page if the program fails to successfully parse the recipe.

{% highlight html %}
{%raw%}{% extends 'layout.html' %}{%endraw%}
{%raw%}{% block content %}{%endraw%}
<form method="POST" action="">
    {%raw%}{{ form.hidden_tag() }}{%endraw%}
    <div class="form-group">
        {%raw%}{{ form.name.label(class="form-control-label") }}{%endraw%}
        {%raw%}{{ form.name(class="form-control") }}{%endraw%}
        {%raw%}{{ form.recipe_lines.label(class="form-control-label") }}{%endraw%}
        {%raw%}{{ form.recipe_lines(class="form-control") }}{%endraw%}
    </div>
    <div class="form-group">
        {%raw%}{{ form.submit }}{%endraw%}
    </div>
</form>
{%raw%}{% endblock content %}{%endraw%}
{% endhighlight %}

As you can see, the page is extremely simple right now. But it has all the functionality I need to get a barebones version of this working.

From there, it was time to actually allow the user to access the page. I decided that I would first create the situation where a failed parse defaulted to this page, because that's a situation I've been dealing with a lot, and at present it was a fairly big hole in my workflow.

First, I had to decide how the program would detect a failed parse. I mulled over several different ways to do this, and ultimately decided that the best place to do so would be after the  `RecipeList` had already been created. This meant that I could still use the "/list/<hexname>/add" route for the list *and* I wouldn't need to rewrite any code for building the recipe. Essentially, the program would run through the whole process of making the recipe, and then check at the end to see if there are any actual lines in it. If there are, great! If not, then we have a problem.

{% highlight python %}
@main.route('/list/<string:list_name>/add/<string:new_recipe>', methods=['GET', 'POST'])
def add_recipe(list_name, new_recipe):
    rlist = RecipeList.query.filter_by(hex_name=new_recipe).first_or_404()
    rlist_lines = RawLine.query.filter_by(rlist=rlist).all()

    if not rlist_lines:  # we failed to extract any lines from the recipe
        form = CustomRecipeForm()
        if form.validate_on_submit():
            pass  # placeholder for now

        form.name.data = rlist.name
        flash('Error: Could not parse recipe lines. Please paste or type recipe lines below: ', 'danger')
        return render_template('custom_add_recipe.html', form=form, rlist=rlist)
{% endhighlight %}

Note also here that I finally implemented a `flash()` feature in the program. Until now I hadn't needed to, but I knew that it was going to come up eventually. It's set up in my "layout.html" file like so:

{% highlight html %}
<div class="container" role="main">
    {%raw%}{% with messages = get_flashed_messages(with_categories=true) %}{%endraw%}
        {%raw%}{% if messages %}{%endraw%}
            {%raw%}{% for category, message in messages %}{%endraw%}
                <div class="alert alert-{%raw%}{{ category }}{%endraw%}">
                    {%raw%}{{ message }}{%endraw%}
                </div>
            {%raw%}{% endfor %}{%endraw%}
        {%raw%}{% endif %}{%endraw%}
    {%raw%}{% endwith %}{%endraw%}
    {%raw%}{% block content %}{% endblock %}{%endraw%}
</div>
{% endhighlight %}

That aside, this enabled me to successfully display the "custom_add_recipe.html" template:

![alt text](/assets/img/posts/custom-recipes/error-parse-recipe.png)

Next, I needed to fill in the code in the `form.validate_on_submit()` function (the one that uses a `pass` above). This was an excellent opportunity to learn a new bit of Python syntax: the `filter()` function. For testing purposes, I was copying a recipe from Allrecipes.com, and the recipe would paste out double-spaced. Then, when I ran a `splitlines()` function, the program would parse out the blank lines as recipe lines. To complicate things further, these lines were not just empty strings; they generally had a whitespace character in them as well.

My solution was to write a filter function that returned false if the list was empty or only whitespace, and true otherwise. From there, I repeated a snippet of code from my `utils.py` folder to parse the recipe lines through my (still only partially trained) spaCy model:

{% highlight python %}
if form.validate_on_submit():
    recipe_lines = form.recipe_lines.data.splitlines()

    def elim_blanks(line):  # function to remove blank lines and spaces from list
        if not line or line.isspace():
            return False
        else:
            return True

    recipe_lines = filter(elim_blanks, recipe_lines)

    for num, line in enumerate(recipe_lines):   # FIXME: this code is the same as in utils.url_to_recipe
        recipe_colors = color_entities_in_line(line)
        recipe_line = RawLine(full_text=line, rlist=rlist, id_in_list=num, text_to_colors=recipe_colors)
        db.session.add(recipe_line)
    rlist.name = form.name.data
    db.session.commit()
    return redirect(url_for('main.add_recipe', list_name=list_name, new_recipe=new_recipe))
{% endhighlight %}

Thus I was able to go from this...

![alt text](/assets/img/posts/custom-recipes/parse-before.png)

... to this!

![alt text](/assets/img/posts/custom-recipes/parse-after.png)

And from there, the rest of my code continues to function as normal. Now, I'll need to add an option to create a new recipe like this from the beginning, but that's a topic for my next post.
