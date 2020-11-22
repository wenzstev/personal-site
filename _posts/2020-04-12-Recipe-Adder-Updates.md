---
layout: post
title: Updating the Recipe Adder
author: Steve
---

Well, it's been a little while since last I posted, but let me tell you, that's not for lack of work. As I near the end of this project, I'm going to try to blog slightly less, but with more content in each post. While I am fond of the pace I've been going on so far, I also feel like it's taking up a lot of time that could be more valuably spent coding. So I'm going to try a 1-2 post per week and see how that goes.

Today's post: the Recipe Adder. It's been a while since I gave it a good update, and there were a number of areas that I wanted to look at. My goal was to get the page to a state of near-completion, where the only things I would want to change after were purely cosmetic palette swaps and other window dressings. And I got pretty close to that goal, or at least, close enough that I feel satisfied.

There were a number of changes that I wanted to make to the recipe adder, to make the use more intuitive and streamlined. For reference, here's a screenshot of the recipe adder before I started to make changes:

![alt text](/assets/img/posts/clean-recipe/buttons-working.png)

This is the last time I really spent time on the page, and it's from *February.* [Here's the link]({% post_url 2020-02-24-Cleaning-Up-Recipe-Lines %}) if you're interested, but regardless, it's clear that this is pretty out of date. The design is utilitarian and uninspired, but that's the least of its problems: under the hood, it lacks support for more than one `CleanedLine` per `RawLine` and the use of forms to submit everything is clunky and non-intuitive.

So lets change that.

### The Recipe Title

The first thing I wanted to do was to get rid of the clunky "Submit" button at the top of the page, as well as the single-line input for the recipe. I'd set it up this way because submitted the whole recipe as a form, and needed keep all the form elements together, but it just didn't look good. When using it, I kept expecting the submit button to be on the bottom, and it just... wasn't.

Plus, I thought that the open text field for the name of the recipe just looked bad. I confess that some of my thoughts in this area were motivated by Trello's user interface; I liked the fact that you could just click on a title at any time and change it, and wanted to implement something similar here.

First, I encircled everything in my new favorite Bootstrap element, the `card`. I liked the idea of visualizing the recipe as a card, the way someone might have an old card box in their kitchen.

Then, I stripped away the old form and the `hex_name` out, because there's no reason for the user to see that. I replaced the form with individual elements: one on top to hold the title, and one on the bottom to submit it. At first I used a `<textarea>` to hold the title, but I then switched to a `contenteditable` div, because it automatically resized without any javascript needed, and I wasn't going to submit the name through a form anyway.

{% highlight html %}
<div class="card my-3 shadow">
    <div class="card-header p-2 shadow-sm">
        <div class="edit-label w-100 text-center" id="recipe-title" contenteditable spellcheck="false">{%raw%}{{ rlist.name }}{%endraw%}</div>
    </div>
{% endhighlight %}

... and on the bottom...

{% highlight html %}
<div class="row justify-content-center">
    <div class="col-md-4 col-lg-2 mb-2">
        <button type="submit" id="submit-list" formmethod="post" class="mt-4 btn btn-success btn-block btn-lg">Submit</button>
    </div>
</div>
{% endhighlight %}

I then styled the card header in such a way that it would look like a normal div, until it was clicked on:

{% highlight css %}
.edit-label {
  resize: none;
  overflow: auto;
  background-color: transparent;
  border: none;
  padding: .25rem;
  font-size: 25px;
  cursor: pointer;
}

.edit-label:focus{
  background-color: white;
  cursor: text;
}
{% endhighlight %}

This created a nice looking header and a serviceable, if still pretty basic, submit button.

![alt text](/assets/img/posts/new-adder/new-title.png)

![alt text](/assets/img/posts/new-adder/new-submit.png)

Not bad, but I still needed to make them do things. For the recipe name, I created a script that sent an ajax request to a new route:

{% highlight javascript %}
function change_recipe_name(){
    $(this).attr('spellcheck', 'false')

    var data = {'recipe_id': $RECIPE_HEX,
                'name': $(this).text()}

    console.log(data)

    $.ajax({
      type: 'POST',
      url: $SCRIPT_ROOT + '/recipe/rename',
      data: data,
      dataType: 'json',
      success: function(jsonData){
        console.log('new name is ' + jsonData['new_name'])
      }
    })
}
{% endhighlight %}

From there, I was able to call this script whenever the user clicked away from the div, and whenever the enter key was pressed:

{% highlight javascript %}
$('#recipe-title').focusout(change_recipe_name)

$('#recipe-title').keypress(function(event){
  if (event.keycode = '13'){
    event.preventDefault()
    change_recipe_name()
    $( this ).blur()
  }
})
{% endhighlight %}

I like the responsiveness of this script, the fact that information is essentially saved as soon as it's changed, without the need to submit any forms. It feels more modern and streamlined to me.

I also took the liberty of moving the `change_recipe_name()` function into a new script, called `global_functions.js`. I then loaded this function on my `layout.html` file. That way, I can access the function from numerous documents, including my list page, on which I plan to implement a version of this same functionality.

With the recipe change working, I then needed to make the new Submit button work. This was a bit tricky for me at first, since I had written all of the logic to create the `CleanedLine`s in a `form.validate_on_submit()` function on my list adder route. I thought about splitting it off into a new route, but that seemed overly complex for the relatively simple problem I was trying to solve.

Ultimately, my solution was a bit hacky. Following some solutions I found on StackOverflow, I created a form on the fly and submitted it when the button was clicked, which in turn triggered my `POST` request on the route:

{% highlight javascript %}
$('#submit-list').click(function(){
  // create a small form and submit with empty post data, cleaning lines
  // is handled server side
  var form = $("<form action='' method='post'></form>")
  $('body').append(form)
  form.submit()
})
{% endhighlight %}

Then, on my route, I modified the triggering condition from a `validate_on_submit()` function to a simple check to see what the method was:

{% highlight python %}
if request.method == "POST":  # we submitted the changes, time to create the cleaned lines
... # do the code
{% endhighlight %}

I tested it and the submit button successfully worked. Time to move on to the next area of improvement.

### Refactoring the `RawLine` Code

In order to prep for my next area, I needed to go through and rewrite some of the code. Particularly since I removed the `hex_name` from the recipe page, my ajax functions to clean the list were broken, because they relied on finding the `RawLine` through its associated `RecipeList`. No list, no line.

Fortunately, this was something that I'd been meaning to change for a while anyway. I'd already rewritten the `CleanedLine` model to work with a `hex_id` attribute, and moved the function that generates that attribute out of the model so that other models could also use it. This made configuring the `RawLine` model to also make use of it a cinch:

{% highlight python %}
def get_hex_id():   # helper function for generating hex identifiers
    return secrets.token_urlsafe(8)

...

class RawLine(db.Model):
    # TODO: refactor so there are less 'id' labels
    id = db.Column(db.Integer, primary_key=True)  # the primary key
    hex_id = db.Column(db.String(8), default=get_hex_id, nullable=False, unique=True) # hex identifier for requests

{% endhighlight %}

I then had to go through and change all the areas where the program tried to find the `RawLine` in the old way. This was really satisfying, however, because it *massively* simplified my code, turning a few spaghetti-like knots into essentially single lines. For example, here's the code that I used to find the `RawLine` when changing the colors of various words:


{% highlight python %}
# before the refactor

line_id = request.form.get('line_id', -1, int)
    if line_id > 0:  # if we have a line id
        print('going by id')
        cur_line = RawLine.query.filter_by(id=line_id).first_or_404()
    else:  # we're finding it from a recipe hex
        print('going by hex')
        recipe_hex = request.form.get('hex_name', '', str)
        recipe_line = request.form.get('recipe_line', -1, int)
        print(recipe_hex, recipe_line)
        recipe = RecipeList.query.filter_by(hex_name=recipe_hex).first_or_404()
        cur_line = RawLine.query.filter_by(rlist=recipe, id_in_list=recipe_line).first_or_404()
        print(cur_line)


# after the refactor
cur_line = RawLine.query.filter_by(hex_id=request.form.get('hex_id', '', str)).first_or_404()
{% endhighlight %}

So much better. Then all I had to do was modify my template so that it used the `hex_id` as the `id` attribute on each line in the Recipe Adder, and my program had all the information it needed to send requests.

Which was a good thing, because it was time to move on to the main event: simplifying and streamlining the process of selecting ingredients.

### The New Ingredient Selector

Before I get into what I actually changed, I want to take a moment to talk philosophy. When I first started this project, I envisioned it as a simple command line tool, then later as a one page web app. In that form, it seemed important to me to store as much information as possible from the recipe lines, so that a user could retrieve it if desired. Because of this, I included named entity recognition for amounts and measurements, figuring that I could add them together and provide additional information.

However, the implementation of my user interface has made some of that redundant, and I think that I sort of lost sight of the original point of this app, which was to create and consolidate a grocery list when buying groceries for multiple recipes. You don't really need to know the amounts or measurements for that, and besides, the toggleable interface that I had was difficult to use, especially on mobile.

So I decided to strip it all out, and only use one entity, the `"INGREDIENT"`, for my app (at least for the first release). So far, I'm keeping the structure of the `"AMOUNT"` and `"MEASUREENT"` entities, because I might want to bring them back in in the future, but for now the main functionality will be in picking out the ingredient from the line.

I went back through my code and altered it so that clicking now only toggled between two classes, and cut out part of the entity parser to do the same. All `CleanedLines` now just have "0" as the amount and `""` as the measurement. Maybe I'll cut them out entirely later, we'll see.

The result of this gave a more simplified look to the recipe adder, but I wasn't done yet. I wanted the words that were not an ingredient to look essentially normal (rather than surrounded by a gray button as can be seen in the picture above), and I wanted to be able to visually mark the edges of an ingredient, preferably with some sort of rounded border. I decided that the best way to do that would be to incorporate dynamic button groups, making use of Bootstrap's `btn-group` class. But since `RawLine`s don't have a natural grouping for any entity (only the indivdual words are marked), I decided to implement the grouping on the client side.

First, I wrote a jQuery function that found all groupings in each ingredient line and wrapped them in a `btn-group` div:

{% highlight javascript %}
var button_group = "<div class='btn-group ingredient-group d-inline align-baseline'></div>"

function create_ingredient_groups(){
  $(".raw-line").each(function(){  // iterate through each line
    current_group = $(button_group) // create button group div
    current_line = $(this)
    $( this ).children().each(function(){
      var next = $(this).next()
      if ($( this ).hasClass('btn-ingredient')){
        $(this).appendTo(current_group)
        if (next.length == 0){
          current_line.append(current_group)
        }
      }
      else if (current_group.children().length > 0){
        // end of button group, insert into line
        console.log("time to insert")
        current_group.insertBefore($(this))
        current_group = $(button_group) // reset group
      }
    })
  });
}
{% endhighlight %}

This code creates a new empty `button_group` div, and iterates along each line, adding buttons with the `.btn-ingredient` class to the group. If it finds another `.btn-base` group, it ends the current button group, and starts a new one if it finds a new `.btn-ingredient.` This way, there can be multiple button groups per line.

So the button groups initialized when the page was loaded; now I needed to dynamically change them with the user's actions. This required a bit more work, as there were a number of different cases that had to be considered. Was the button clicked:

1. Already inside a button group? If so, was it:
- at the beginning,
- at the end,
- both (one-word group), or
- neither (in the middle)?

2. If it was outside a button group, was it:
- adjacent to a button group in front of it,
- adjacent to a button group after it,
- both (surrounded by button groups), or
- neither (no button groups around)?

In total, eight different possibilities, with each one requiring a different outcome. The code kept twisting in my head while I wrote this, so I ended up commenting on it pretty heavily:

{% highlight javascript %}
function update_ingredient_groups(button){
  console.log(button.text())

  // check if button is in group
  if (button.parent().hasClass('btn-group')){
    // if it's in a group, we need to remove it
    // if it is in the middle of the group, we need to split the group
    at_beginning = (button.prev().length==0)
    at_end = (button.next().length==0)

    if (at_beginning){
      if (at_end){
        // one word group, just remove
        button.unwrap()
      }
      else {
        // drop from beginning
        console.log(button.parent().prev())
        button.insertAfter(button.parent().prev())
      }
    }
    else if (at_end){
      // drop from end
      button.insertBefore(button.parent().next())
    }
    else { // split the group
      // create new button group
      new_group = $(button_group) // create button group div
      // move the second half of the group into the second group
      new_group.append(button.nextAll())
      // move the button up one
      button.insertBefore(button.parent().next())
      // append group after button
      new_group.insertAfter(button)
    }
  }
  else { // button is not in a group
    group_before = button.prev().hasClass('btn-group')
    group_after = button.next().hasClass('btn-group')
    if (group_before){
      if (group_after){
        // combine the two groups
        // get the buttons in the next group
        group_to_combine = button.next().children()
        // get rid of the group around them
        group_to_combine.unwrap()
        // insert them into the group before
        group_to_combine.appendTo(button.prev())
        // insert the button into the group before them
        button.insertBefore(group_to_combine)
      }
      else {
        // insert button into the group before it
        button.appendTo(button.prev())
      }
    }
    else {
      if (group_after){
        // insert button into the group after it
        button.prependTo(button.next())
      }
      else {
        // create a new group
        button.wrap(button_group)
      }
    }
  }
}
{% endhighlight %}

There are a lot of `if` statements here, and I think I might be better served with some sort of `switch`, but at the moment I'm just satisfied it works. You can see that I make extensive use of the `.hasClass()` funtion to determine where the button groups are in relation to the clicked button.

One issue that I had to deal with was cases where the button group was at the beginning or end of the line, in which case there was not an additional element before or after to append it to. I solved this by inserting empty `<span>` objects at the beginning and end of the line, to provide an anchor point and eliminate additional cases. Ensuring that there would always be a previous object and a next object greatly simplified the code.

But I wasn't quite done. I added some simple css code to round the edges at the beginning and ending of the groups, with an additional case to check if the group only had one button:

{% highlight css %}
.btn-ingredient {
  background-color: coral;
  color: white;
  font-style: normal;
  cursor: pointer;
}

.btn-ingredient:first-child{
  border-radius: 10px 0px 0px 10px;
}

.btn-ingredient:last-child{
  border-radius: 0px 10px 10px 0px;
}

.btn-ingredient:only-child{
  border-radius: 10px;
}
{% endhighlight %}

I then modified some of the color schemes and tried to give the overall page a more modern look, and here's what I came up with:

![alt text](/assets/img/posts/new-adder/new-recipe-lines.png)

Much nicer, although I'm still not entirely done. Something about the current look feels too "educational" to me. But I think that's mostly a color scheme choice, and after I develop a more comprehensive sense of the style of the website, I'll go back and give this a fresh coat of paint.

Now, I had one final thing to add before I needed to take a break to write this blog post. The new support for more than one button group on a line implied support for more than one *ingredient* on a line, which meant more than one `CleanedLine` per `RawLine`. Previously, this wasn't possible, as There was a "many-to-one" relationship between `CleanedLine`s and `RawLine`s; multiple `RawLine`s could point to one `CleanedLine`, but the reverse wasn't true. So I needed to change that, too.

### A Many-To-Many Relationship Between Lines

To implement this, I had to go back to YouTube for some tutorials. I found [this](https://www.youtube.com/watch?v=OvhoYbjtiKc) one to be particularly useful, and was able to set up a relationship table between the `CleanedLine` and the `RawLine` models. Here's the current code for those models and the table:

{% highlight python %}
line_assocs = db.Table('line_assocs',
                       db.Column('rawline_id', db.Integer, db.ForeignKey('raw_line.id')),
                       db.Column('cleanedline_id', db.Integer, db.ForeignKey('cleaned_line.id'))
                       )


class RawLine(db.Model):
    # TODO: refactor so there are less 'id' labels
    id = db.Column(db.Integer, primary_key=True)  # the primary key
    hex_id = db.Column(db.String(8), default=get_hex_id, nullable=False, unique=True) # hex identifier for requests
    full_text = db.Column(db.String(100), nullable=False)  # the text of the line
    list_id = db.Column(db.Integer, db.ForeignKey('recipe_list.id'))  # the id of the list for the line
    text_to_colors = db.Column(db.String)
    cleaned_lines = db.relationship('CleanedLine', secondary=line_assocs, backref=db.backref('raw_lines', lazy='dynamic'))

    def __repr__(self):
        return f"{self.full_text}"


class CleanedLine(db.Model):
    id = db.Column(db.Integer, primary_key=True)   # the primary key
    index_in_list = db.Column(db.Integer)  # index in the grocery list (for requests) TODO: create this automatically
    hex_id = db.Column(db.String(8), default=get_hex_id, nullable=False, unique=True) # hex identifier for requests
    amount = db.Column(db.Float)    # the amount of ingredient (optional)
    measurement = db.Column(db.String(20))  # the measurement of the amount (optional)
    ingredient = db.Column(db.String(100), nullable=False)  # the ingredient (required)
    checked = db.Column(db.Boolean, default=False)  # whether or not the item is checked off the list
    comp_list = db.Column(db.Integer, db.ForeignKey('compiled_list.id'))

    def __repr__(self):
        return f"{self.ingredient} in list {self.comp_list}"
{% endhighlight %}

None of this is particularly complex, but it was my first time implementing a many-to-many relationship, and I'm pleased it worked out. I did have to make some minor modifications to how the program created the new lines, but most of it was quite straightforward. And, as a consequence, I can now have two ingredients from the same recipe line:

![alt text](/assets/img/posts/new-adder/two-ingredients-one-line.png)

In this example, it's just salt and pepper, but it works as proof of concept. There are a few more cases that I'm going to need to handle for this, however, such as what happens when a user edits an ingredient to combine them later on the list page. But seeing as this post is focused on the recipe adder, I decided to put that off until next time.

And that's it! It's been quite a bit of work done since my last post, and I think this is my longest post yet. Even so, there are still a few areas that I would like to change on the recipe adder. Most notably, I think it would be better for punctuation marks like commas and parentheses to not have their own buttons, as it's sort of counterintuitive and clunky. That will get smoothed out when I go through another pass. But for now, I'm turning my attention to the main list page, so expect a new post about that by the end of the week!
