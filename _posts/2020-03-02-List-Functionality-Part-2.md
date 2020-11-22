---
layout: post
title: More List Functionality -- Adding Edit Lines and Details
author: Steve
---

Next, I wanted to add the ability to edit lines after they were already entered into the list. I felt that this would be useful for situations where a line was entered wrong and needed to be changed, or if a user wanted to alter two ingredients to combine them (say, "all-purpose flour" and "flour").

At first, I experimented with adding the same functionality from the "clean list" page onto the main page, but it honestly seemed very cumbersome, and left open the possibility that someone would change it by accident. So instead, I opted to add some additional information to the raw lines, and a link to edit them:

![alt text](/assets/img/posts/recipe-line-info/line-partially-working.png)

The CSS styling here has been surprisingly tricky, and it's the main reason why I haven't made a blog post in the last few days. I wanted to float the button on the right, but they didn't stay in the line when I shrank the window, and wouldn't be good for mobile users. I played with a lot of options and currently have settled on just setting the absolute position:

![alt text](/assets/img/posts/recipe-line-info/edit-position-absolute.png)

Which works, except the text is then covered up. I may or may not keep this, because I kind of like the idea of having the button appear when hovered over. At the same time, though, not sure if that's a good idea for mobile users. So I may be in the business of making two (slightly) different designs here. But I'll keep what I've got for now.

Next, I modified the button into an anchor tag and added a `url_for()` link to direct the user to the appropriate "clean list" page:

{% highlight html %}
<a href="{%raw%}{{ url_for('main.add_recipe', list_name=comp_list.hex_name, new_recipe=raw_line.recipe.hex_name)}}{%endraw%}"  class="edit-button">Edit</a>
{% endhighlight %}

This... didn't work. When I tried to click the link, it didn't click. However, when I right clicked the link and clicked "open in new tab," it worked just fine. As is often the case in times of trouble, I turned to StackOverflow, and found [this](https://stackoverflow.com/questions/15050095/a-link-not-working-by-clicking-only-work-by-open-link-in-new-tab-command) helpful answer. It seemed that there was some JavaScript that was messing up the default functioning of the link. I was able to go into the inspector and found the culprit pretty easily:

![alt text](/assets/img/posts/recipe-line-info/jquery-killing-link.png)

Removing this script made the link work just fine. Of course, removing that script also broke the jQuery on my page: no collapsible menus. Quite the conundrum.

Luckily, the solution was to be found on the same StackOverflow question: override the `preventDefault()` command with an `onClick()` command of my own. I added this to the (already quite long) `<a>` tag, with the additional `_self` parameter in place to ensure that it didn't open in a new tab:

{% highlight html %}
<a href="{%raw%}{{ url_for('main.add_recipe', list_name=comp_list.hex_name, new_recipe=raw_line.recipe.hex_name)}}{%endraw%}"
onclick="window.open('{%raw%}{{url_for('main.add_recipe', list_name=comp_list.hex_name, new_recipe=raw_line.recipe.hex_name)}}{%endraw%}','_self')" class="edit-button">Edit_</a>
{% endhighlight %}

This made the link work. Hooray! We are on our way. Or are we?

I tested the function of the link by altering one of the recipe lines, changing "angel hair pasta" to just "angel hair." When I saved the changes, I discovered a new, rather annoying bug:

![alt text](/assets/img/posts/recipe-line-info/angel-hair-doubled.png)

The recipe added the new line, but didn't remove the old one. Consequently, I now had two lines that described thin pasta with very fine, almost angelic, texture. To make matters worse, the link on the original angel hair was broken; see here that it no longer has a green dot next to it, and I can't click on it to reveal the line.

It was evident that I had forgotten to delete the previous line from my database. I decided to do this in the `validate_on_submit()` function call on the "clean list" page:

{% highlight python %}
# check if rawline already has a cleanedline
    if line.cline_id:
      # remove the old line
      cleaned_line_to_delete = CleanedLine.query.filter_by(id=line.cline_id).first()
      db.session.delete(cleaned_line_to_delete)
      db.session.commit()
{% endhighlight %}

This just checks to see if the `RawLine` is already attached to a `CleanedLine`. If it is, that means that we're editing a previous cleaned line, and so we delete it before proceeding onto the new line.

However, writing this out now, I'm realizing that it discounts another important case: this code will delete a `CompiledLine`, even if there are `RawLine`s from other recipes that point to it.

Luckily, this is also an easy fix. I query all of the `RawLine`s that point to the `CleanedLine` I want to delete. If it's okay to delete that line, there will only be one, and I delete it. Otherwise, I leave it alone:

{% highlight python %}
# check if rawline already has a cleanedline
if line.cline_id:
    # remove the old line
    cleaned_line_to_delete = CleanedLine.query.filter_by(id=line.cline_id).first()
    raw_line_check_list = RawLine.query.filter_by(cleaned_line=cleaned_line_to_delete).all()
    if len(raw_line_check_list) == 1:  # check if other RawLines link to this CompiledLine
        db.session.delete(cleaned_line_to_delete)
        db.session.commit()
{% endhighlight %}

With this solved, it was time to fix the "Add Line" button.

#### Fixing "Add Line"

First, I decided to take the "Add Line" button and input out of the form it was in. I did this because I wanted to have a greater amount of control over what would happen when I clicked the "Add Line" button; I didn't just want to have the form submit. I created a few lines of HTML to add a new line and button:

{% highlight html %}
<input id="add-line-input" class="form-control" type="text">
<button id="add-line-submit" class="btn btn-secondary"> Add Line </button>
{% endhighlight %}

Then, it was time for some jQuery. I decided that I wanted to pass the line through the spaCy model with an ajax request, because I wanted the user to be able to modify it in real time before submitting it to the list. To that end, I bound a `click` event to the "Add Line" button and submitted a request:
{% highlight javascript %}
$("#add-line-submit").on("click", function (){
  var new_line = $("#add-line-input").val()

  var data = {
    'line_text': new_line
  }

  $.ajax({
    type: 'POST',
    url: $SCRIPT_ROOT + '/clean/parse_line',
    data: data,
    dataType: 'json',
    success: function(jsonData){
      console.log('success!')
      console.log(jsonData)
    }
  })
{% endhighlight %}

Then, I created a new route in my `main.py` folder that parsed an individual line that was sent to it:

{% highlight python %}
@main.route('/clean/parse_line', methods=['GET', 'POST'])
def parse_line():
    new_line = request.form.get('line_text', '', type=str)
    print(new_line)
    parsed_line = color_entities_in_line(new_line)
    print(parsed_line)

    new_raw_line = RawLine(id_in_list=-1, full_text=new_line, text_to_colors=parsed_line)
    db.session.add(new_raw_line)
    db.session.commit()

    return parsed_line
{% endhighlight %}

This then would return the parsed line to the client. Now I just needed to figure out what to do with it. I decided that I wanted to use the same button format that I had on the "clean list" page, except just for the single line. The user could then edit the line as necessary and click a final button to "commit" the line to the database. The page would then refresh, with the new line changed as necessary. I wrote the following function in the `success` line of the ajax command:  

{% highlight javascript %}

var compiled_list = $('#compiled-list')
compiled_list.append("<div id='clean-line' class='list-group-item btn-group'></div>")

var clean_line = $("#clean-line")

var word_buttons = []
for (var word in jsonData){
  clean_line.append("<button class=" + jsonData[word] + " word-button>" + word + "</button>")
}

$("#add-line-submit").toggleClass("hidden")
$("#add-line-input").toggleClass("hidden")

clean_line.append("<div id='commit-new-line' class='button-panel recipe-div'></div>")

$("#commit-new-line").append("<a class='edit-button' href='" + $SCRIPT_ROOT + "/list/" + $LIST_HEX + "/commit" + "'>Commit</a>")
{% endhighlight %}

This created a set of buttons and appended them to the recipe list. I also hid the "Add Line" button and input so that the user wouldn't be able to add more than one line at a time.

![alt text](/assets/img/posts/recipe-line-info/add-line-buttons.png)

Not quite done, though. I still needed to implement a version of the code that's on my "Clean List" page: the ability to click the words, have them change, and commit those changes through an ajax call.

To do this, I adapted code from my `clean_list.js` file, adding a note to refactor this later to reduce repeated code.

{% highlight javascript %}
// TODO: refactor so there isn't reused javascript like this
    var b_dict = {
      'btn-base': 'btn-ingredient',
      'btn-ingredient': 'btn-measurement',
      'btn-measurement': 'btn-amount',
      'btn-amount': 'btn-base',
    }
    var patt = /btn-[\w]+/  // regex pattern to find button class

    $('.word-button').click(function(){
      var btn_class = $( this ).attr("class").match(patt)[0]

      $( this ).toggleClass(btn_class)
      $( this ).toggleClass(b_dict[btn_class])
    })

    var children = clean_line.children()

    var button_colors = {}

    for (var i = 0; i < children.length; i++){
      button_text = $(children[i]).text()
      button_color = $(children[i]).attr('class').match(patt)[0]
      console.log(button_color)
      button_colors[button_text] = button_color
    }

    var data = {
      text_to_colors: JSON.stringify(button_colors)
    }

    $.ajax({
      type: 'POST',
      url: $SCRIPT_ROOT + "/clean/set_color",
      data: data,
      dataType: 'json',
      success: function(jsonData){
        console.log('ajax successful!')
      }
    })
{% endhighlight %}

However, I soon realized a problem. My `'/clean/set_color'` route expects more information than I was providing, chiefly the `hex_name` of the `RecipeList` that the `RawLine` came from, to aid in looking it up. Unfortunately, the `RawLine`s that would be made from the "Add Line" button didn't have a `RecipeList` associated with them, because they're independently added by the user. This resulted in an error when the server tried to find the line. I would need a new way to look up the `RawLine`.

After some thought, I decided that the simplest and best thing to do would be to look up the `RawLine` by it's `id` attribute. That's what the `id` attribute is for, right? I added a few extra lines of code to the route that created the new `RawLine`:

{% highlight python %}
return {'line_id': new_raw_line.id,
           'parsed_line': json.loads(parsed_line)}  # have to load it to make sure it's formatted properly for client
{% endhighlight %}

But this led to another problem, one that I had wondered about for a while, but until now had not encountered. When I entered in the test line `"1 package green jello"`, this is what I got out:

![alt text](/assets/img/posts/recipe-line-info/mixed-order.png)

One green jello package. Not one package green jello. The words are mixed up. And they're mixed up (I think) because the way I'm storing this data, dictionaries and JSON objects, don't preserve order. They just preserve key/value pairs. When I was originally designing this code, I wondered if I would get in trouble for this, because I was iterating through the list without really checking if the order had changed. Up until now, however, I had been fortunate enough that the list just hadn't changed. But my luck had just run out. And besides, this isn't really best practices.

So I'm gonna have to do a bit of refactoring before I get this code working. It's fine; I've been kind of needing to do a bit of that anyway, but it's still a bit disheartening. I decided to put this blog post out now to give myself a feeling of accomplishment, even though I'm not totally done, because I've been writing it for a while and it's getting long. Next time, I'll pick a new data type for this code, and finally get the "Add Line" feature working.
