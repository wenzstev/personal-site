---
layout: post
title: Renaming Lists
author: Steve
---

Now, it's time to begin the road map established in the last post. The first item on our list? Renaming. I decided to go with an ajax request here, to avoid having to refresh or needing a new page. I suspect that I will use a lot of ajax requests in the near future.

First, I added button with simple CSS style next to the recipe name.

{% highlight html %}
<div id="complist-name-div">
    <h1 id="complist-name">{{ comp_list.name }}</h1>
    <button id="rename-list-button" class="btn btn-secondary">Rename</button>
</div>
{% endhighlight %}

And the CSS:

{% highlight css %}
#rename-list-button {
  position: relative;
  display: inline;
  top: -8px;
  left: 5px;
}

#complist-name{
  display: inline;
}
{% endhighlight %}

This created a simple button to use:

![alt text](/assets/img/posts/edit-list-name/new-rename-button.png)

Then, I wrote a script to hide these buttons and replace them with an input field and a button that, when clicked, sent an ajax request to an as-yet uncreated route.

{% highlight javascript %}
$('#rename-list-button').on("click", function(){
  var complist_div = $("#complist-name-div")
  var list_name = $("#complist-name").text()
  console.log(list_name)
  $("#complist-name").toggleClass("hidden")
  $( this ).toggleClass("hidden")
  $("<input id=change-name-input></input>").prependTo(complist_div).val(list_name)
  $("<button id='confirm-name-button'>Confirm</button>").appendTo(complist_div).on("click", function(){
    // put ajax here
  })
})
{% endhighlight %}

Now, when clicked, the button produced an input field and the necessary "Confirm" button:

![alt text](/assets/img/posts/edit-list-name/new-rename-input.png)

No CSS styling here but we'll fix that in a bit. Now I added the ajax code, which sends the new name to the still-uncreated route, and when successful, changes the name on the list name and returns the items to their original look.

{% highlight javascript %}
$("<button id='confirm-name-button'>Confirm</button>").appendTo(complist_div).on("click", function(){
  var new_name = $("#change-name-input").val()
  $.ajax({
    type:'POST',
    url: $SCRIPT_ROOT + '/list/rename',
    data: { 'name': new_name,
            'list': $LIST_HEX,
          },
    dataType: 'json',
    success: function(jsonData){
      console.log(jsonData)
      $("#change-name-input").remove()
      $("#confirm-name-button" ).remove()
      $("#complist-name").text(jsonData['name']).toggleClass("hidden")
      $("#rename-list-button").toggleClass("hidden")
    }
  })
})
{% endhighlight %}

Now I created the route, which just uses the database call here to rename the list and change the name. It sends the new name back, and I use that piece of data, rather than my input field on the client, to update the name. I do that to make sure the name in the database and the one on the client are the same.

{% highlight python %}
@main.route('/list/rename', methods=['GET', 'POST'])
def change_name():
    list_to_rename = CompiledList.query.filter_by(hex_name=request.form.get('list', '', type=str)).first_or_404()
    list_to_rename.name = request.form.get('name', 'ERROR', type=str)
    db.session.commit()

    return jsonify(name=list_to_rename.name)
{% endhighlight %}

Then I added a few quick CSS stylings to the input box and `btn btn-secondary` classes to the button, to give them a bit of styling:
 {% highlight css %}
 .name-input {
   font-size: 24px;
   width: 80%;
 }
 {% endhighlight %}

![alt text](/assets/img/posts/edit-list-name/new-rename-styling.png)

One final area of housekeeping before I checked this piece off the list: the list name changed in the title, but it did *not* change the list name in my navbar. This would change the next time the page was refreshed, but for the sake of completeness, I wanted to make it change when everything else did.

It was a simple solution. First, I added a dynamic `id` attribute to the `<a>` link for each list:

{% highlight html %}
<li><a id="link-{%raw%}{{list.hex_name}}{%endraw%}" href="{%raw%}{{url_for('main.compiled_list', hex_name=list.hex_name)}}{%endraw%}">{%raw%}{{ list.name }}{%endraw%} ({%raw%}{{ list.hex_name }}{%endraw%})</a></li>

{% endhighlight %}

Then, changing the text was as simple as a single line of javascript:

{% highlight javascript %}
$("#link-"+$LIST_HEX).text(jsonData['name'] + ' (' + $LIST_HEX + ')')
{% endhighlight %}

There. Everything changes. While I would like to change the styling on the edit process a bit more, I'm going to classify that as part of my later "style overhaul" and continue with my general mantra of "if it functions, it's good for now."

#### Next Steps
* add the ability to check an item off the list
* add the ability to delete a list item
* add links to the recipes if made from a url
