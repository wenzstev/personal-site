---
layout: post
title: Giving the User the Ability to Clean Recipe Lines
author: Steve
---

To remind my very-existing readership what the buttons look like so far, here's a picture:

![alt text](/assets/img/posts/clean-recipe/old-button-look.png)

Extremely basic, pretty ugly, shows the functionality but that's about it. I started with some CSS styling to make them look better and bring them closer together.

{% highlight css%}
.btn-group button {
  border: none;
  padding: 5px  5px;
  float: left;
  overflow: auto;
  color: white;
}

.btn-group{
  overflow: auto;
  display: block;
}

.word-button {
  margin: 0;
  font-size: 20px;
}
{% endhighlight %}

These classes were then added to the html on my template:

{% highlight html %}
<ul class="list-group">
    {%raw%}{% for line in rlist_lines %}{%endraw%}
    <div class="list-group-item btn-group" id="{%raw%}{{ line.id_in_list }}{%endraw%}">
        {%raw%}{% for token, color in line.text_to_colors.items() %}{%endraw%}
            <button class="{%raw%}{{ color }}{%endraw%} word-button" >{%raw%}{{ token }}{%endraw%}</button>
        {%raw%}{% endfor %}{%endraw%}
    </div>
    {%raw%}{% endfor %}{%endraw%}
</ul>
{% endhighlight %}

But I wasn't quite done. Previously, I was using Bootstrap's built-in `text` classes to color the buttons different colors. I wanted to customize these colors more, and to do that I would need some new, custom classes. I created four, each with a different background color, as a proof of concept:

{% highlight css %}
.btn-ingredient {
  background-color: coral;
}

.btn-amount {
  background-color: darkorchid;
}

.btn-measurement {
  background-color: darkseagreen;
}

.btn-base {
  background-color: darkgray;
}
{% endhighlight %}

Then, I went back into my `utils.py` folder to modify the code that aligned the classes. While there, I decided to do a quick refactor that I'd made a note of before. First, I created a dictionary that linked the names of the entities from spaCy's system with teh class names that I had just created:

{% highlight python %}
line_colors = {
    "INGREDIENT": "btn-ingredient",
    "CARDINAL": "btn-amount",
    "QUANTITY": "btn-measurement",
    "O": "btn-base"
}
{% endhighlight %}

Here, `"O"` is what spaCy uses to mark that a word is not an entity.

Next, I modified the `color_entities_in_line()` function to use the dictionary instead of a bunch of `if` statements (though I still needed a few). My code went from this:

{% highlight python %}
# TODO: Refactor into using a dict of some kind
def color_entities_in_line(line,
                           ingredient_color="text-success",
                           cardinal_color="text-warning",
                           quantity_color="text-primary",
                           base_color="text-secondary"):
    color_tuples = {}   # dict of tuples of token and the color
    doc = nlp(line)
    for token in doc:
        if token.ent_iob_ == "O":   # if the token is outside an entity
            color_tuples[token.text] = base_color
        else:
            if token.ent_type_ == "INGREDIENT":
                color_tuples[token.text] = ingredient_color
            elif token.ent_type_ == "CARDINAL":
                color_tuples[token.text] = cardinal_color
            elif token.ent_type_ == "QUANTITY":
                color_tuples[token.text] = quantity_color
    return json.dumps(color_tuples)
{% endhighlight %}

... to this:

{% highlight python %}
def color_entities_in_line(line, line_colors=line_colors):
    color_tuples = {}   # dict of tuples of token and the color
    doc = nlp(line)
    for token in doc:
        if token.ent_iob_ == "O":   # if the token is outside an entity
            color_tuples[token.text] = line_colors["O"]
        else:
            color_tuples[token.text] = line_colors[token.ent_type_]
    return json.dumps(color_tuples)
{% endhighlight %}

Cutting the length of the function in half (9 to 18 lines) and increasing the reusability (since I use the `line_colors` dictionary in other areas).

So now the cleaning page was feeding through my custom class. Behold:

![alt text](/assets/img/posts/clean-recipe/new-button-look.png)

These colors aren't perfect and I'm currently lacking any coherent sense of style (just like real life *zing*), but the important thing is that I have editable classes that are fed in through the spaCy program.

*Note: At this point, I also realized that it would probably be better to train my spaCy model to recognize all numbers as one entity, rather than separating independent numbers from number/measurement pairs. It makes more sense to the reader that way. Just something to keep in mind for the future.*

### Adding Functionality

Now, it's time to add the ability to change the classes. Recall that, previously, I had only used the `toggleClass()` function of jQuery to hide the button when clicked on, more as a proof of concept than as any actual functionality. It was time to change that.

First, on a note of housekeeping, I separated the jQuery script from the HTML template (previously it had made its home in a `<script>` tag at the bottom of the page), and put it into its own `.js` file. A simple `url_for()` command took care of the linking:

{% highlight html %}
<script src="{%raw%}{{url_for('static', filename='clean-list.js')}}{%endraw%}"></script>

{% endhighlight %}

Now, onto the JavaScript itself. I thought for a bit of how best to implement the ability to change the color: do I click to cycle, or have a sort of palette where the desired category is selected to determine what category the click is set to. Ultimately, I decided on the former, because it seemed easier to implement and because it seemed easier to work on mobile devices (always a concern!). In the future, I might make the selection process a bit smarter (for example, if the selection is a number, prevent it from being selected as an "ingredient"), but for now the simpler option is what I'm going with.

Now, for the second quesiton: how to structure the code? Because I'm trying to improve my Think Like A Programmer (tm) skills, I wanted to come up with a more elegant solution than a simple set of `if` statements. After some pondering, I decided to create a makeshift dictionary object, and link the button classes together so that they formed a loop:

{% highlight JavaScript %}
var b_dict = {
    'btn-base': 'btn-ingredient',
    'btn-ingredient': 'btn-measurement',
    'btn-measurement': 'btn-amount',
    'btn-amount': 'btn-base',
  }
{% endhighlight %}

Then, I wrote a small regex function to extract the button class (delineated with the "btn-" prefix). This was necessary in case the button had other classes associated with it; I wanted to avoid redundancies. From there, I made two `toggleClass()` calls to turn of the current class, and turn on whatever class was next in the dictionary cycle.

{% highlight javascript %}
var patt = /btn-[\w]+/  // regex pattern to find button class

var btn_class = $( this ).attr("class").match(patt)[0]

$( this ).toggleClass(btn_class)
$( this ).toggleClass(b_dict[btn_class])
{% endhighlight %}

From there, I reviewed the ajax code that I'd written [previously]({% post_url 2020-02-13-Coloring-Strings-And-More-Complex-Data%}) and found, to my delight, that it mostly would continue to work as written. I made a few minor changes to ensure that the right class was being passed to the request, but otherwise the routing and requests continued to work as expected:

{% highlight JavaScript %}
var line = $( this ).parent()
    var line_id = line.attr('id')

    var children = line.children()

    var button_colors = {}

    for (var i = 0; i < children.length; i++){
      button_text = $(children[i]).text()
      button_color = $(children[i]).attr('class').match(patt)[0]
      button_colors[button_text] = button_color
    }


    var data = {'hex_name': hex_name,
                'id': line_id,
                'text_to_colors': JSON.stringify(button_colors)}

    $.ajax({
      type: 'POST',
      url: $SCRIPT_ROOT + '/clean/set_color',
      data: data,
      dataType: 'json',
      success: function(jsonData){
        console.log(jsonData)
      }
    })
{% endhighlight %}

I loaded everything up, and...

![oops](/assets/img/posts/clean-recipe/list-not-working.png)

Oops. Something was wrong. The recipe lines weren't getting parsed correctly. I checked back through my code and smacked my head when I realized that I'd forgotten a crucial part of the python refactor I'd done last time. The code was still using the old Bootstrap classes to parse the lines:

{% highlight python %}
def extract_ingredients(color_string,
                        ingredient_color="text-success",
                        cardinal_color="text-warning",
                        quantity_color="text-primary"):
    ingredient = ''
    measurement = ''
    amount = 0
    color_dict = json.loads(color_string)
    for word, color in color_dict.items():
        if color == ingredient_color:
            ingredient += word + ' '
        elif color == cardinal_color:
            amount = float(sum(Fraction(s) for s in word.split()))  # treat the string as a fraction and sum
        elif color == quantity_color:
            try:
                amount = float(sum(Fraction(s) for s in word.split())) # see if the word is an amount
            except ValueError:  # if it's not an amount
                measurement += word + ' '

    return amount, measurement, ingredient
{% endhighlight %}

Those classes, of course, were nowhere to be seen. Luckily, this was an easy fix. I simply brought in the dictionary object I created earlier. Here's the changed code:

{% highlight python %}
for word, color in color_dict.items():
    if color == line_colors["INGREDIENT"]:
        ingredient += word + ' '
    elif color == line_colors["CARDINAL"]:
        amount = float(sum(Fraction(s) for s in word.split()))  # treat the string as a fraction and sum
    elif color == line_colors["QUANTITY"]:
        try:
            amount = float(sum(Fraction(s) for s in word.split()))  # see if the word is an amount
        except ValueError:  # if it's not an amount
            measurement += word + ' '
{% endhighlight %}

This could probably still be refactored better in the future (hell, most of this can), but I'm satisfied for now.

And does it work? Oh yeah.

![alt text](/assets/img/posts/clean-recipe/buttons-working.png)

Here you can see a cleaned list, with the appropriate labels for each ingredient, amount, and measurement. Note in particular the "uncooked medium shrimp" line, which spaCy didn't catch at all. Matters much less when the user can edit the response themselves.

And when submit is pressed, the list compiles properly:

![alt text](/assets/img/posts/clean-recipe/cleaned-working.png)

*(Kronk voice)* Oh yeah, it's all coming together.

#### Next Steps
* implement the same editing functionality on the main list page
* fix the "Add Line" button
