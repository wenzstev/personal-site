---
layout: post
title: Creating a More Interactive List Page
author: Steve
---

It was now time for me to add more interactivity to the list page, which at present does nothing but show the ingredients. I thought for a while on how to do this, and spent a few days chasing a lark in the form of a sidebar. I still might go back to that, but I realized that I was not being faithful to my primary goal in this endeavor, which is to get everything functioning first, and worry about making it pretty later. To that end, I decided that I would go with a simple second list, displaying all the recipes on the side, like so:

![alt text](/assets/img/posts/show-recipes.png)

Next, I wanted  some way to distinguish the lines in the list that are attached to each individual recipe. I decided that the best way to do that would be to assign a random color to the recipe when the user first enters it, and use that color as the distinguishing feature of the recipe on the list page.

First, I added a line in the database to store a color for the recipe:

{% highlight python %}
hex_color = db.Column(db.String(6), nullable=False)  # randomly generated color for use in lists
{% endhighlight %}

 Because my brain sometimes misses things that are right in front of my face, I first tried to use a hex from the `secrets` module:

{% highlight python %}
hex_color = secrets.token_urlsafe(6)
{% endhighlight %}

I added this to the creation of each `RecipeList`. Of course, this didn't work, because the `secrets.token_urlsafe()` function does not return a hex that is necessarily a valid color. I consulted the internet for a solution to random colors in python, and found [this](https://stackoverflow.com/questions/13998901/generating-a-random-hex-color-in-python). It was fairly easy to incorporate into my code, like so:

{% highlight python %}
r = lambda: random.randint(0, 255)
hex_color = ('#%02X%02X%02X' % (r(), r(), r()))
{% endhighlight %}

From there, I went into the list template page, and added some inline CSS that matched the appropriate color:

{% highlight html %}
{%raw%}{% for recipe in recipe_list %}{%endraw%}
    <a class="recipe-button list-group-item"><span class="dot" style="background-color:{%raw%}{{recipe.hex_color}}{%endraw%}"></span> {%raw%}{{recipe.name}}{%endraw%} </a>
{%raw%}{% endfor %}{%endraw%}
{% endhighlight %}

Note that the `dot` class is a simple span I made to structure a small circle, which is what I wanted to be dynamically colored. I loaded it up and was delighted to see those beautiful, beautiful colored dots.

![alt text](/assets/img/posts/app-recipeinterface/dynamic-recipe-dots.png)

Now, to get them on the recipe lines as well.

I thought for a little while of how to do this, because I did not have a direct connection between the `CleanedLine` items and the `RecipeList` items. What I did have was a relationship from `CleanedLine` to `RawLine` to `RecipeList`, but I wouldn't be able to do those queries on the template.

Ultimately, I decided that what I *really* needed was a list of all the `RawLine`s for each `CleanedLine`, both for this and for some later additions. And because I needed to generate this information on the server, I felt it best to encapsulate it into a python class, similarly to how I made the json values work on the "cleaning" page. Here's my implementation:

{% highlight python %}
# class that takes the db CleanedLine object and turns it into a python class to pass to template
class CompiledIngredientLine:
    def __init__(self, cleaned_line):
        self.ingredient = cleaned_line.ingredient
        self.amount = cleaned_line.amount
        self.measurement = cleaned_line.measurement

        # get list of all raw lines that make up the cleaned line
        self.raw_lines = RawLine.query.filter_by(cleaned_line=cleaned_line).all()

        self.color_dots = set()
        for raw_line in self.raw_lines:
            recipe = RecipeList.query.filter_by(id=raw_line.list_id).first_or_404()
            self.color_dots.add(recipe.hex_color)
{% endhighlight %}

Note that I still query the recipe for the color, instead of just the `RawLine`. I might change this, but I didn't want to double add an amount to the database if I could help it. So this sacrifices some performance for a better style.

It was a simple one-liner to change the `CleanedLine` list into a `CompiledIngredientLine`:

{% highlight python %}
list_lines = [CompiledIngredientLine(line) for line in list_lines]
{% endhighlight %}

I then modified my template to add as many spans as necessary to incorporate all the dots:

{% highlight html %}
<li class="list-group-item">
        {%raw%}{% for dot in line.color_dots %}{%endraw%}
                <span class="dot" style="background-color:{%raw%}{{dot}}{%endraw%}""></span>
        {%raw%}{% endfor %}{%endraw%}
        {%raw%}{{ line.ingredient }}{%endraw%}
</li>
{% endhighlight %}

Everything seems to be working:

![alt text](/assets/img/posts/app-recipeinterface/dots-on-list.png)

But I still wasn't quite done. I wanted a bit more interactivity to this list, to better engage the user. To that end, I wanted the ability to toggle the dots, so that when the user clicks on the recipe, the dots appear, and when the user clicks again, they disappear. Furthermore, I wanted to do the same when the user hovers, to give a preview of what it woudl look like.

And for those tasks, it was time to return to jQuery. Adding hovering and clicking to the recipe dots was accomplished easily enough by querying the `.recipe-button` class and toggling it to `hidden`. I then toggled `active` when it was clicked on, and checked in the hover to make sure the class wasn't active before applying the toggle.

{% highlight javascript %}
$(document).ready(function(){
  var recipe_buttons = $('.recipe-button')

  recipe_buttons.hover(
    function(){
      if(!$( this ).hasClass("active")){
        $( this ).find("span").toggleClass("hidden")
      }
    },
    function(){
      if(!$( this ).hasClass("active")){
        $( this ).find("span").toggleClass("hidden")
      }
    }
  )

  recipe_buttons.click(function(){
    $( this ).toggleClass("active")
  })

})
{% endhighlight %}

This allows the dots to appear and disappear when they are hovered, and to stay when clicked. I wasn't done, however. I still wanted to link the dots on the Recipe List with the dots on the Compiled list. That way, when they were hovered over, the dots on the compiled list would appear to show the ingredients associated with that recipe.

This wouldn't work with a `find()` command, so I consulted the jQuery documentation and found the `filter()` command, which can have a function passed to it.

{% highlight javascript %}
var dot = $( this ).find("span")
var color = dot.css("background-color")

var dots_to_hide = $("#compiled-list").find("span").filter(function(){
  return $( this ).css("background-color") === color
})
{% endhighlight %}

This function finds all of the `dot` spans in the `.compiled-list` class, and returns them if they have the same color as the `dot` in the recipe list. Then, hiding them is as easy as:

{% highlight javascript %}
dots_to_hide.toggleClass("hidden")
{% endhighlight %}

Not too shabby. But I still wasn't quite done. There was a lot of rewritten code, which I found offensive to my newly-developing jQuery sensibilities. I decided to rewrite the `hover()` code into a separate function and call it for both on- and off-hover. The final code was a bit more elegant:

{% highlight javascript %}
$(document).ready(function(){
  var link_dots = function(){
    if(!$( this ).hasClass("active")){
      var dot = $( this ).find("span")
      var color = dot.css("background-color")
      dot.toggleClass("hidden")

      var dots_to_hide = $("#compiled-list").find("span").filter(function(){
        return $( this ).css("background-color") === color
      })
      dots_to_hide.toggleClass("hidden")
  }
}

  var recipe_buttons = $('.recipe-button')

  recipe_buttons.hover(link_dots(), link_dots())
  recipe_buttons.click(function(){
    $( this ).toggleClass("active")
  })
})
{% endhighlight %}

After all that, I'm delighted to say that it's working as intended:

![alt text](/assets/img/posts/app-recipeinterface/clicked-dots.png)

In this picture, you can see that the top "Bailey's Red Velvet Tres Leches Cake" is clicked, and that the matching blue-purple dots are similarly activated on the other side. Likewise, you can see at the bottom that the "angel hair pasta" line does not have a dot, because it's associated with the "Parmesan-Crusted Shrimp Scampi" recipe. So that's good.

There are a few glitches, however. Every now and then, for some reason, the dot toggle seems to reverse, so that when I hover/click the dots disappear instead of appear. I'm marking it down as a bug for now, and will probably go back through to add some more checks to make sure it doesn't happen.

Next steps:
* show the actual `RawLine` when a recipe list item is clicked
* add the ability to edit recipe lines
* add the ability to add additional lines

### An Update 2/21 (Because I am a dumb dumb)

I turned on my app today to get cracking on the next feature, and discovered to my horror that none of my scripts from yesterday were working. Luckily it was a quick fix, but the solution left me red in the face. Folks, we have some JavaScript errors. Turns out I shouldn't have declared the function with the `var` keyword and, more importantly, I shouldn't have used parenthesis in the `hover()` function when using my `link_dots` function. The proper code looks like this:

{% highlight javascript %}
$(document).ready(function(){
  function link_dots(){
    if(!$( this ).hasClass("active")){
      var dot = $( this ).find("span")
      var color = dot.css("background-color")
      dot.toggleClass("hidden")

      var dots_to_hide = $("#compiled-list").find("span").filter(function(){
        return $( this ).css("background-color") === color
      })
      dots_to_hide.toggleClass("hidden")
  }
}

  var recipe_buttons = $('.recipe-button')

  recipe_buttons.hover(link_dots, link_dots)
  recipe_buttons.click(function(){
    $( this ).toggleClass("active")
  })
})
{% endhighlight %}

I'm not sure why I didn't catch these bugs yesterday, since the code was working. My best guess is that it was loading the older, working JavaScript from the cache (the non-refactored code), and therefore the bugs didn't go through. It's an easy fix, but still kind of annoying. Oh well. On to the next features!
