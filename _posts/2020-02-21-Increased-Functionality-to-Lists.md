---
layout: post
title: Deepening Interactivity on the List Page
author: Steve
---

This is largely a continuation of my previous post, regarding putting some more information on the list page. There's a twist at the end, though, just to keep you on your toes.

That's right, I'm burying the lede.

I wanted to add the original recipe lines that every ingredient line came from. I conceived of each ingredient line as a button that would, when clicked, show a collapsible list of all recipe lines that went into it. Adding the recipe lines was fairly easy because I had already included them in my `CompiledIngredientLine` class.

Because collapsible menus require an `id` attribute to function, I added a new variable to the `CompiledIngredientLine` class that turned the ingredient name into an id using the `string.replace()` function:

{% highlight python %}
self.ingredient_id = cleaned_line.ingredient.replace(" ", "-")  # ingredient id for use in html
{% endhighlight %}

From there, it was fairly easy to make use of Bootstrap's `collapse` feature to implement the list:

{% highlight html %}
<div class="list-group list-group-root well" id="compiled-list">
                {%raw%}{% for line in list_lines %}{%endraw%}
                <a href="#{%raw%}{{line.ingredient_id}}{%endraw%}" class="list-group-item" data-toggle="collapse">
                    {%raw%}{% for dot in line.color_dots %}{%endraw%}
                        <span class="dot hidden {%raw%}{{dot}}{%endraw%}" style="background-color:{%raw%}{{dot}}{%endraw%}""></span>
                    {%raw%}{% endfor %}{%endraw%}
                    {%raw%}{{ line.ingredient }}{%endraw%}
                </a>
                    {%raw%}{% if line.raw_lines %}{%endraw%}
                    <div class="list-group collapse" id="{%raw%}{{line.ingredient_id}}{%endraw%}">
                        {%raw%}{% for raw_line in line.raw_lines %}{%endraw%}
                            <a href="#" class="list-group-item" data-toggle="collapse">
                                {%raw%}{{raw_line.full_text}}{%endraw%}
                            </a>
                        {%raw%}{% endfor %}{%endraw%}
                    </div>
                    {%raw%}{% endif %}{%endraw%}
                {%raw%}{% endfor %}{%endraw%}
            </div>
{% endhighlight %}

I then applied some CSS styles to create a nested look:

{% highlight css %}
.list-group.list-group-root {
  padding: 0;
  overflow: hidden;
}

.list-group.list-group-root .list-group{
  margin-bottom: 0;
}

.list-group.list-group-root .list-group-item {
  border-radius: 0;
  border-width: 1px 0 0 0;
}

.list-group.list-group-root > .list-group-item:first-child {
  border-top-width: 0;
}

.list-group.list-group-root > .list-group > .list-group-item{
  padding-left: 30px;
}
{% endhighlight %}

This information was adapted from [this](https://stackoverflow.com/questions/29063244/consistent-styling-for-nested-lists-with-bootstrap) StackOverflow question, but I plan to add some customization to make it my own.

But it's working!

![alt text](/assets/img/posts/app-recipe-dropdown/dropdown-lines.png)

Next, I wanted to add a little bit more information to the line. I reviewed my code from the cleaning page, and decided to add the same color coding to the `RawLine`s on the recipe page. Ideally, this would allow me to fairly easily change both areas when I finally get around to doing that (which will be soon, I think).

First, I modified the `CompiledIngredientLine` class to return a set of `LineToPass` objects instead of the original `RawLine` object. I did this because the `LineToPass` object has the JSON color data stored as a dictionary and I want to access it. This was easy to adjust:

{% highlight python %}
self.raw_lines = [LineToPass(line) for line in self.raw_lines]
{% endhighlight %}

Then, I iterated through each token in the line and passed a span with the correct color through, the same way I did on the "clean" page:

{% highlight html %}
<a href="#" class="list-group-item" data-toggle="collapse">
        "
        {%raw%}{% for token, color in raw_line.text_to_colors.items() %}{%endraw%}
          <span class="{%raw%}{{color}}{%endraw%}">{%raw%}{{token}}{%endraw%}</span>
        {%raw%}{% endfor %}{%endraw%}
        "
</a>
{% endhighlight %}

Gave it a quick test and everything seems to be working:

![alt text](/assets/img/posts/app-recipe-dropdown/colored-lines.png)

Now, it was almost time for me to add in the final big feature of the app: the ability to change the ingredient in the line. But that's still a fairly large feature and deserves its own post, so I first wanted to add a few extra notes of interactivity to the list menu. Definitely not because I'm putting off the other thing. Definitely not.

ANYWAY I decided it was time to fix the "Add Line" button so that it actually worked. First, I created a new form in my `forms.py` module:

{% highlight python %}
class AddLineForm(FlaskForm):
    recipe_line = StringField("Type an Ingredient or a recipe line")
    submit = SubmitField("Add Line")
{% endhighlight %}

Next, I added the routing information to my list page. I wanted the program to do the same thing it does when a full recipe is added, but just to one line. Then it just returns a redirect to the same place, where, if everything works right, the new line should appear.

{% highlight python %}
if add_line_form.validate_on_submit():
    new_line = add_line_form.recipe_line.data
    new_line_colors = color_entities_in_line(new_line)
    new_raw_line = RawLine(id_in_list=0, full_text=new_line, text_to_colors=new_line_colors)
    db.session.add(new_raw_line)
    db.session.commit()

    amount, measurement, ingredient = extract_ingredients(new_line_colors)
    new_cleaned_line = CleanedLine(amount=amount,
                                   measurement=measurement,
                                   ingredient=ingredient,
                                   list=comp_list)
    db.session.add(new_cleaned_line)
    db.session.commit()

    new_raw_line.cleaned_line = new_cleaned_line

    return redirect(url_for('main.compiled_list', hex_name=hex_name))
{% endhighlight %}

Almost time to test. From there, I went into the list template and added in the form information on the bottom:

{% highlight html %}
<form method="POST" action="">
    {%raw%}{{add_line_form.hidden_tag()}}{%endraw%}
    <fieldset>
        <div class="form-group">
            {%raw%}{{ add_line_form.recipe_line(class="form-control" )}}{%endraw%}
        </div>
    </fieldset>
    <div class="form-group">
        {%raw%}{{ add_line_form.submit(class="btn btn-primary") }}{%endraw%}
    </div>
</form>
{% endhighlight %}

This created a nice little text line at the bottom of the recipe:

![alt text](/assets/img/posts/app-recipe-dropdown/add-line-form.png)

In the future, when I start to work on restyling this into something more unique and interesting, I'd like to hide that line unless a button is clicked. But for now, in keeping with my general philosophy of functionality, I just want it to work.

And does it? Well...

![alt text](/assets/img/posts/app-recipe-dropdown/kind-of-but-not-really.png)

Kind of. But not really. What you're seeing here is a number of `ingredient`-less list items, as well as a few that did work. In my debugging process, I soon realized that the problem did not actually lie with the new code I'd written, but instead with the spaCy ingredient parser model that I'd trained. In essence, it wasn't good enough at picking up ingredients to find a them in most of the examples I put in. In particular, it seems to do a very poor job when a line consists of *just* an ingredient, without any measurement or amount to qualify it. I suspect that's because it's not been trained very well with just ingredients, seeing as most recipe lines have an amount and a measurement. But if a user is just typing in an ingredient they need (as would usually be the case when an additional line is added), it's not going to work nearly as well.

There's another issue here as well. If you look, you'll see that "grated parmesan cheese" is duplicated. Part of the whole point of this device is to catch and compile duplicates, which it is currently failing to do. Not a good look.

So what's a frustrated programmer to do? I had two choices: I could return to my spaCy model and retrain it for ingredients, or I could add in the ability to modify/improve the NER on a per-line basis. I'm going to have to do both of these eventually, but I wasn't ready to return to spaCy just yet; the thought of hand annotating another several hundred lines of data isn't very appealing. Plus, I have a suspicion that I can use this app to make that annotation process easier, and I'm all about making things easier.

So it's time to fix the recipe cleaning page. I'm a bit annoyed that I'm going to have to end this blog post with some features that don't work all the way, but I've gotten to the point where the recipe cleaning functionality is too interconnected with the rest of the app to no longer be fixed, and I've got to go were the squeaky wheel needs the grease. Mixing metaphors here, but hopefully you get the idea. 
