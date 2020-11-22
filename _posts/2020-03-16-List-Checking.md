---
layout: post
title: Checking Items off the List
author: Steve
---

With the completion of the "Rename" button, it was time to move onto the next item on my list: the ability to "check off" or temporarily disable recipe ingredients. I wanted to add this feature in case someone already had ingredients in their home, but didn't necessarily want to delete the item from their list. In cases like this, it would be a good idea to be able to toggle an item.

In order to ensure persistence between refreshes, I decided that the best option would be to add a boolean value to my `CleanedLine` database model, that would then determine if the line was disabled or not.

{% highlight python %}
checked = d.Column(db.Boolean, default=False)  # whether or not the item is checked off the list
{% endhighlight %}

This value defaults to false and is initialized with each new  `CleanedLine` item. From there, I decided that the next thing I would do would be to add the actual checkbox that the user would use to toggle the list item.

This, unfortunately, required a whole lot of rather unfun CSS learning. I'm still fairly new and shaky at the frontend part of this whole "App Development" thing, and it took me longer than I care to admit to figure out the right combination of `div`s, `label`s, and `input`s that got a working, decent-looking custom checkbox to the left of each list item.

There were lots of errors and problems, but I want to highlight one in particular that stymied me for a while. I'd finally gotten to the point where I had a box to the left of the items, but there was this unexplained gap between each line that was not represented by any element in the DOM:

![alt text](/assets/img/posts/check-and-delete/unexplained-space.png)

I really scratched my head over this one, but it turns out that it was due to the fact that I was moving the list objects to the right and up using a `position: relative` CSS command, and that when that's done, the space where the component *would* have gone remains empty. Hence the negative lines. The problem was solved by setting the margins of the objects to a negative amount, except for the first child (otherwise, the "cooking oil" line you see above would have overlapped with the list name). I use this issue as an example of the kind of problem I faced: one with an ultimately simple, if counterintuitive, solution, but which got me stuck because I'm still learning how to do all this. While I'm definitely getting better, I have to say that frontend CSS work is easily my least favorite part of this whole process. Which is a shame, because I want this thing to look nice.

But anyway, I finally got a look that's acceptable for now, although I do plan to come back at some point for more beautification.

![alt text](/assets/img/posts/check-and-delete/checkbox-fornow.png)

Here's the html that I came up with:

{% highlight html %}
<div class="list-group list-group-root " id="compiled-list">
    {%raw%}{% for line in list_lines %}{%endraw%}
      <label class="recipe-label">
          <input id="checkbox-{%raw%}{{line.hex_id}}{%endraw%}" type="checkbox"{%raw%}{{line.checked}}{%endraw%}>
          <span class="recipe-checkbox"></span>
      </label>
      <div id="line-{%raw%}{{line.hex_id}}{%endraw%}" class="recipe-line">
          <a href="#{%raw%}{{line.ingredient_id}}{%endraw%}" class="list-group-item" data-toggle="collapse" aria-expanded="false" role="button">
          {%raw%}{% for dot in line.color_dots %}{%endraw%}
              <span class="dot top-level hidden" style="background-color:{%raw%}{{dot}}{%endraw%}"></span>
                    {%raw%}{% endfor %}{%endraw%}
                    {%raw%}{{ line.ingredient }}{%endraw%}
          </a>
          ...
  </div>
{% endhighlight %}

You'll notice several new features here. The first is the addition of some new classes, which I used to create the CSS here:

{% highlight css %}
.recipe-line {
  position: relative;
  top: -30px;
  left: 40px;
  vertical-align: top;
}

.recipe-checkbox{
  background-color: aliceblue;
  border: 3px solid #ddd;
  width: 40px;
  height: 40px;
  display: block;
  cursor: pointer;
}

.recipe-label input {
  opacity: 0;
  height: 0;
  width: 0;
  position: absolute;
  cursor: pointer;
}

.recipe-label {
  display: block;
  cursor: pointer;
  width: 30px;
  height: 30px;
  margin: 0px;
}

.recipe-label:not(:first-child){
  margin-top:-30px;
}

.recipe-checkbox:hover {
  background-color: gray;
}

.recipe-label input:checked ~ .recipe-checkbox {
  background-color: lightgray;
}
{% endhighlight %}

This was used to create the custom checkboxes and move around the list objects so that they were next to the checkboxes. It was a huge pain in the ass and I'm glad it's done; CSS is kind of bad, folks.

The second, more interesting (at least to me) thing to note is the `{%raw%}{{line.checked}}{%endraw%}` template call that's inside the `<input>` checkbox. This is how I decided to show if the boxes were checked or not. In my `utils.py` file, a check is made in the `CompiledIngredientLine` class (which converts the `CleanedLine` database object into what the template uses):

{% highlight python %}
self.checked = ""
if cleaned_line.checked:
    self.checked = " checked"
{% endhighlight %}

This way, the `{%raw%}{{line.checked}}{%endraw%}` call will return `" checked"` if true, and nothing if false, causing the `<input>` to be checked or not.

The next thing you'll note is the inclusion of a new database attribute to the `CleanedLine` class:  the `hex_id` line. This came about when I was trying to determine how best to make my ajax call and reference the necessary line. At first, I thought to simply include the database `id` into the id of the checkbox, but I had avoided doing that in the past and I didn't want to start now. Instead, I decided to google my concerns, to see if there were any industry standard ways around this problem.

As it turns out, there are. I quickly found [this](https://medium.com/lightrail/prevent-business-intelligence-leaks-by-using-uuids-instead-of-database-ids-on-urls-and-in-apis-17f15669fd2e) article about UUIDs, and realized that I had been implementing something similar without realizing it in my `hex_name` attributes. Although the concerns raised in the article about business security don't really apply to me (basically no one's going to be using this app anyway), I still feel it's best to adhere to proper standards.

To that end, I created a quick function in my `models.py` folder that returns a hex value, and added a new line into my `CompiledList` model that uses it:

{% highlight python %}
def get_hex_id():   # helper function for generating hex identifiers
    return secrets.token_urlsafe(8)
...

class CleanedLine(db.Model):
  ...
  hex_id = db.Column(db.String(8), default=get_hex_id, nullable=False, unique=True) # hex identifier for requests
{% endhighlight %}

At the same time, I made a note to go back and refactor my other models so they used the same function. This would ensure that every database item created in my code will have a unique identifier, and vastly simplifies some of my eariler work in trying to figure out how to identify lines.

Then, creating unique `id`s for the checkboxes and the lines was simple as importing this new `hex_id` attribute and attaching it to a word which identified the type of component: `<input>` components got an `id` called `"checkbox-{%raw%}{{line.hex_id}}{%endraw%}"`, while the lines themselves (`<div>` components) got `id`s called `line-{%raw%}{{line.hex_id}}{%endraw%}`.

This made the jQuery much easier to deal with. Here's the code I put together for that:

{% highlight javascript %}
$('.recipe-label').find('input').on("change", function(){
    var selected_line = $( this ).attr('id')
    data = {'line': selected_line.slice(9, 20)}

    $.ajax({
      type: 'POST',
      url: $SCRIPT_ROOT + '/line/checked',
      data: data,
      dataType: 'json',
      success: function(jsonData){
        console.log('line activation set to ' + jsonData['isActive'])
      }
    })
  })
{% endhighlight %}

Once again, the code is quite simple and short when I figured out how to do it, but I suppose that's just one of the downsides to learning as you go. I'm hoping my second project will move a bit quicker than this, precisely because I will know what I'm doing (at least somewhat).

Because this ajax request sent information to a route that didn't exist, it was time to make that route.

{% highlight python %}
@main.route('/line/checked', methods=['POST'])
def toggle_line_check():
    print(request.form.get('line'))
    line_to_toggle = CleanedLine.query.filter_by(hex_id=request.form.get('line', '', type=str)).first_or_404()
    line_to_toggle.checked = not line_to_toggle.checked
    db.session.commit()
    return jsonify(isActive=line_to_toggle.checked,
                   line = line_to_toggle.hex_id)
{% endhighlight %}

This area is again pretty self-explanatory. The code gets the `hex_id` and uses it to find the list, then toggles whether the list is turned on or not. It commits the change and returns the toggled value, as well as the `hex_id` of the changed line. Why return the `hex_id`? Because there was one last piece of this to do. I wanted to cross out the line in question, to show that it was disabled. This was accomplised with a single line of jQuery:

{% highlight javascript %}
$('#line-' + jsonData['line']).toggleClass('strikethrough')
{% endhighlight %}

The `strikethrough` class is extremely simple and just creates a line through all text. In the future, I plan to expand this class to make the crossing out look a bit more sophisticated.

One final area: I need to cross out the lines when the page first loads. I did this by finding all checked boxes, finding their matched lines through the shared `hex_name`, and crossing them out as well:

{% highlight javascript %}
var checked_lines = $('.recipe-label').find('input:checked').each(function(index){
  var this_id = $( this ).attr('id').slice(9, 20)
  console.log('line-'+this_id)
  var line_to_cross = $('#line-' + this_id)
  console.log(line_to_cross)
  line_to_cross.addClass('strikethrough')
})
{% endhighlight %}

As you can see below, everything is working.

![alt text](/assets/img/posts/check-and-delete/crossed-out-items.png)

And that's a wrap! Whew, this one took me a bit longer than I wanted it to, but I'm hopeful that several problems I solved here (chiefly the addition of the `hex_id`) will aid me in the next few additions to my list functionality.

#### Next Steps
* delete items from list
* move list items around
