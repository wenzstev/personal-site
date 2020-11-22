---
layout: post
title: Deleting Lines on the Grocery List
author: Steve
---

Now, it's time to give the user the ability to delete a line. First, I created a button for the user to click to delete a line. I added some basic CSS for a minimal look, and used the &#10006 character for an even "✖".

{% highlight html %}
<button id="delete-{%raw%}{{line.hex_id}}{%endraw%}" class="remove-button">{%raw%}&#10006{%endraw%}</button>
{% endhighlight %}

And the css:

{% highlight css %}
.remove-button {
  float: right;
  display: inline;
  position: relative;
  background-color: transparent;
  border: none;
  border-radius: 50%;
  right: 30px;
  color: indianred;
  font-weight: bold;
  outline: none;
}
{% endhighlight %}

This created a nice, minimalist delete button.

![alt text](/assets/img/posts/check-and-delete/delete-button.png)

Now, I added the code for what would happen when the button was clicked. I decided to use a `confirm()` method in the javascript, in order to keep things simple for now. Might come back in the future to make it look a bit more fancy.

{% highlight javascript %}
$('.remove-button').on('click', function(){
  var del = confirm("Are you sure you want to delete this line?")
  if (del==true){
    var line_to_delete = $( this ).attr('id').slice(7, 18)
    console.log(line_to_delete)
    data = {"line": line_to_delete}
    $.ajax({
      type: 'POST',
      url: $SCRIPT_ROOT + "/line/delete",
      data: data,
      dataType: 'json',
      success: function(jsonData){
        var deleted_line = jsonData["line"]
        console.log("deleted " + deleted_line)
        $("#line-" + deleted_line).remove()
        $("#checkbox-" + deleted_line).parent().remove()
      }
    })
  }
})
{% endhighlight %}

This script binds an `on('click')` event to each delete button. When clicked, it prompts the user to make sure they want to delete the button. If they do, the script takes the line's `hex_id` from the `id` of the button and sends an ajax request to my as yet-uncreated route `'/line/delete'`. Should this route execute properly, the checkbox and the line corresponding to the list item are found with the same `hex_id` and removed. This essentially functions the same way my checkbox functions, and I benefited significantly from the fact that I already had this architecture in place.

Now, onto the route.

{% highlight python %}
@main.route('/line/delete', methods=['POST'])
def delete_line():
    print(request.form.get('line'))
    line_to_delete = CleanedLine.query.filter_by(hex_id=request.form.get('line', '', type=str)).first_or_404()
    db.session.delete(line_to_delete)
    db.session.commit()
    return jsonify(line=request.form.get('line'))
{% endhighlight %}

The route again takes its queues almost entirely from the `'/line/checked'` route. It finds the line by the provided `hex_id` and then deletes it. Assuming this was successful, it returns the line's `hex_id` so that the client can use it to delete the line.

Pretty simple stuff, and it all works. This is a short post today, but I wanted to get it out, and honestly it's really refreshing to be able to implement a feature so cleanly and with so little hassle. I'm hopeful that this shows both a) that I'm improving in my skills, and b) that I've constructed a strong architecture for the program.

#### Next Steps:
* move list items around
* access recipe if gotten from url
