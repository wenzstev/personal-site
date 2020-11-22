---
layout: post
title: Dragging List Items Around
author: Steve
---

Now it's time for the next item on my [list]({%post_url 2020-03-11-Plan-For-Future%}): the ability to move list items around. I wanted to implement this feature both because it's a nice quality-of-life feature for a user, and because it seemed like an interesting challenge to take on.

But in order to drag items, one first must have a button to allow dragging. I used the triple bar (≡) symbol in a button, and styled it similarly to how I styled my delete button. It required a bit of restyling and organizing my line, but it came out pretty good:

![alt text](/assets/img/posts/drag-list/drag-button.png)

Here's the html I came up with:

{% highlight html %}
<div id="full-{%raw%}{{line.hex_id}}{%endraw%}" class="full-line">
  <label id="label-{%raw%}{{line.hex_id}}{%endraw%}" class="recipe-label">
    <input id="checkbox-{%raw%}{{line.hex_id}}{%endraw%}" type="checkbox"{%raw%}{{line.checked}}{%endraw%}>
    <span class="recipe-checkbox"></span>
  </label>
  <div id="line-{%raw%}{{line.hex_id}}{%endraw%}" class="recipe-line">
      <a href="#{%raw%}{{line.ingredient_id}}{%endraw%}" class="list-group-item recipe-list" data-toggle="collapse" aria-expanded="false" role="button">
        <button id=drag-{%raw%}{{line.hex_id}}{%endraw%} class="drag-button">&#8801</button>
        <span class="ingredient-name">
            {%raw%}{% for dot in line.color_dots %}{%endraw%}
              <span class="dot top-level hidden" style="background-color:{%raw%}{{dot}}{%endraw%}"></span>
            {%raw%}{% endfor %}{%endraw%}
            {%raw%}{{ line.ingredient }}{%endraw%}
          </span>
          <button id="delete-{%raw%}{{line.hex_id}}{%endraw%}" class="remove-button">&#10006</button>
      </a>
      {%raw%}{% if line.raw_lines %}{%endraw%}
        <div class="list-group collapse" id="{%raw%}{{line.ingredient_id}}{%endraw%}">
          {%raw%}{% for raw_line in line.raw_lines %}{%endraw%}
            <div class="list-group-item list-flex" data-toggle="collapse" id="{%raw%}{{raw_line.recipe.hex_name}}{%endraw%}-{%raw%}{{raw_line.id_in_list}}{%endraw%}">
                <div class="recipe-info">
                    <span class="dot" style="background-color:{%raw%}{{raw_line.recipe.hex_color}}{%endraw%}"></span>
                    <div class="recipe-div">"{%raw%}{{raw_line.full_text}}{%endraw%}"</div>
                    <div class="recipe-name recipe-div">{%raw%}{{raw_line.recipe.name}}{%endraw%}</div>
                </div>
                <div class="button-panel recipe-div">
                    <button class="edit-button">Edit</button>
                </div>
            </div>
          {%raw%}{% endfor %}{%endraw%}
        </div>
      {%raw%}{% endif %}{%endraw%}
  </div>
</div>
{% endhighlight %}

...and the CSS:

{% highlight css %}
.recipe-list{
  height: 40px;
}

.drag-button {
  border: none;
  color: darkgray;
  outline: none;
  background-color: transparent;
  position: relative;
  right: 8px;
  bottom: 8px;
  font-size: x-large;
}

.drag-button:hover {
  cursor: move;
}

.ingredient-name {
  position: relative;
  bottom: 10px;
  right: 5px;
}

.recipe-info{
  display: inline;
  position: relative;
  left: 25px;
}
{% endhighlight %}

One thing to note here in the html is that I finally go around to wrapping both the `<label>` and the line `<div>` into a single `<div>`, which would be much easier to facilitate movement. I played for a little while with the idea of capturing all of the different pieces separately, but soon realized that such an approach was needlessly complicating, and also directly counter to how components are supposed to work in general. But this was a small hiccup, and by and large this part of the process went rather smoothly.

Next, I needed to actually implement the ability to drag. I looked up a few different options for this, and at first considered using jQueryUI, which has pretty easy, convenient functions to make dragging a cinch. I ultimately decided against it, however, for three reasons: one, jQueryUI seems to be a bit out of date and has iffy support; two, I didn't like the idea of introducing a whole new library just for one function; and three, I wanted the practice of doing it myself. So I scanned through a few different conversations on StackExchange, and found [this](https://stackoverflow.com/questions/2424191/how-do-i-make-an-element-draggable-in-jquery) topic to get me started. I implemented a version of this, more or less, for my first attempt:

{% highlight javascript %}
function handle_mousedown(e){
  e.preventDefault()  // necessary to prevent the anchor from activating
  console.log("mouse down")

  var dragged_line = $( this ).parents('.full-line')

  window.my_dragging = {};
  my_dragging.pageX0 = e.pageX
  my_dragging.pageY0 = e.pageY
  my_dragging.elem = dragged_line
  my_dragging.offset0 = dragged_line.offset()

  console.log(my_dragging.offset0)

  function handle_dragging(e){
    e.preventDefault()
    var left = my_dragging.offset0.left + (e.pageX - my_dragging.pageX0)
    var top = my_dragging.offset0.top + (e.pageY - my_dragging.pageY0)
    $(my_dragging.elem).offset({top: top, left: left})
  }
  function handle_mouseup(e){
    e.preventDefault()
    console.log("mouse up")
    $('body')
    .off('mousemove', handle_dragging)
    .off('mouseup', handle_mouseup);
  }
  $('body')
  .on('mouseup', handle_mouseup)
  .on('mousemove', handle_dragging);
}

$('.drag-button').mousedown(handle_mousedown)

{% endhighlight %}

The only real thing I changed here was that I needed to get the parent of the button object, rather than the parent itself. But this code successfully allowed me to drag an object around the screen. The only problem was, it stayed where I put it, and didn't have any concept of where it was "supposed" to be. In order to fix that, I needed to implement some code of my own.

After playing around with it a bit, I decided that the best thing to do would be to get a list of all the `full-line` components, except for the one I was dragging. When the mouse was released, I would then loop through all of the found components and their `offset`s, comparing them to the `offset` of my dragged component. When the program found which two `top` values the dragged component was between, it inserted the dragged component after it using the `insertAfter()` function:


{% highlight javascript %}
function handle_mouseup(e){
      e.preventDefault()
      console.log("mouse up")

      var all_lines = $('.full-line').not(dragged_line)


      var found = false
      for(var i = 0; i < all_lines.length-1; i++){
      if(found) break  // determines if we've found the point of insertion
        var current_line = all_lines[i]

        if($(all_lines[i]).offset().top < dragged_line.offset().top
          && $(all_lines[i+1]).offset().top > dragged_line.offset().top){
            dragged_line.insertAfter($(all_lines[i]))
            found = true
          }
        }

        dragged_line.removeAttr('style')


      $('body')
      .off('mousemove', handle_dragging)
      .off('mouseup', handle_mouseup);
    }
{% endhighlight %}

A few things to note about this code. I chose not to use the `.each()` function (which would cycle through the gathered components without needing to implement a loop) because I needed to check the list with the index that was next. Upon review, there are ways around this (for example, I could perhaps have measured the height of one line and added that amount to each component to see if that was the right one to insert), but this is an acceptable answer to me right now. I feel similarly about the fact that I used a `for` loop with a boolean that forced a break, instead of a `while` loop. That's going into a `FIXME` for later.

So, this code effectively allows a user to manipulate the string order by moving the lines around. Problem is, a quick refresh wipes the slate clean again. We need to fix that, and in order to do so, it's time to involve the backend.

First, I went into my `models.py` file and created a new variable in the `CleanedLine` model: `index_in_list`, which is a simple integer value that determines where in the list each individual line is. Then, went into the list creation process and added infrastructure to support this new variable. Whenever a new `CleanedLine` item was added to a list, the length of the `CompiledList` was checked and an index was assigned accordingly, placing the new line at the end of the list:

{% highlight python %}
current_list_length = len(current_list_lines)  # get the length of the current list
...
cleaned_line = CleanedLine(amount=amount,
                                              measurement=measurement,
                                              ingredient=ingredient,
                                              list=current_list,
                                              index_in_list=current_list_length)
                   current_list_length += 1  # add one to get the new length of the list

{% endhighlight%}

... and in the code which allows the addition of single lines:

{% highlight python %}
current_list_length = len(list_lines)

        amount, measurement, ingredient = extract_ingredients(new_line_colors)
        new_cleaned_line = CleanedLine(amount=amount,
                                       measurement=measurement,
                                       ingredient=ingredient,
                                       list=comp_list,
                                       index_in_list=current_list_length)

{% endhighlight %}

Then, I wrote a quick function that sorts the gathered list items by their `index_in_list`. This is done before the list items are turned into their `CompiledIngredientLine` versions, and makes use of the `sort()` function in python:

{% highlight python %}
# sort by the index_in_list function
def sort_by_index(e):
    return e.index_in_list
list_lines.sort(key=sort_by_index)
{% endhighlight %}

All well and good so far, but now the backend needed a way to change the list order. For this, I turned to my current best friend, ajax.

I inserted an ajax request into the `handle_mouseup()` function. This request gets the list of all lines and creates a JSON object where the `hex_id` of the line is the key for the index of the line in the list:

{% highlight javascript %}
// send ajax request to reorder the list
      var line_list = {}
      $('.full-line').each(function(index){
        line_list[$(this).attr('id').slice(5,16)] = index
      })


      $.ajax({
        type: 'POST',
        url: $SCRIPT_ROOT + '/list/reorder',
        data: {
          'list': $LIST_HEX,
          'order': JSON.stringify(line_list)
        },
        dataType: 'json',
        success: function(jsonData){
          console.log('list reordered')
        }
      })
{% endhighlight %}

Why did I do it this way instead of, say, a simple array? I'm glad you asked! Let's head over to the backend and create my new route, and I'll show you exactly why.

{% highlight python %}
@main.route('/list/reorder', methods=['POST'])
def reorder_list():
    list_to_reorder = CompiledList.query.filter_by(hex_name=request.form.get('list', '', type=str)).first_or_404()
    list_lines_to_reorder = CleanedLine.query.filter_by(list=list_to_reorder)
    new_order = json.loads(request.form.get('order'))

    for line in list_lines_to_reorder:
        print(line.hex_id)
        line.index_in_list = new_order[line.hex_id]
        print("new index for " + line.hex_id + " is " + str(line.index_in_list))

    db.session.commit()

    return jsonify(order=new_order)
{% endhighlight %}

This route first retrieves the list to reorder and all of the lines in the list. It then converts the JSON object into a python dictionary. Armed with these two pieces of information, it cycles through all the lines and uses the line's `hex_id` attribute to set its new `index_in_list` attribute. This makes lookup fast and elegant (at least to me). Once all the new items are in, it returns the order (though the frontend doesn't do anything with this piece of information at the moment).

And does it work? Oh yeah.

![alt text](/assets/img/posts/drag-list/list-order-1.png)

![alt text](/assets/img/posts/drag-list/list-order-2.png)

Here's two screenshots of the same list. As you can see, the items on the top have been reordered. This now persists through refreshing and closing down the server. Job well done.

I would like to return to this area in the future, though, because there are some quality-of-life additions I would like to make. For one thing, I would like for the position where the list will snap to to be shown when dragging, most likely with the use of a placeholder `<div>` of some kind. Also, I would like some kind of sliding animation, where the div slides into place and the other items slide up and down to accommodate it. I think that would be a really nice effect. But in keeping with my current mantra of "get everything in, make it pretty later", I'm going to move on for now.

#### Next Steps
* access recipe if it came from a url
* begin adding ways to export and print the list
