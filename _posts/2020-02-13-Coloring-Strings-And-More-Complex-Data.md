---
layout: post
title: JSON and Databases and AJAX -- Oh My!
author: Steve
---

The last few days have largely been about proof of concept; namely, showing that I can make all the independent pieces of this project work before I bring them all together into a beautiful symphony.

First, I wanted to be able to change the color of the text based on if spaCy found it as an entity or not. I loaded in my old spaCy entity trainer. I decided to do this in the `__init__` file, since I would probably be using it numerous times throughout the app. From there, I imported it into my `utils.py` file that I currently have in my `main` Blueprint.

Then I wrote a quick function to scan the document for entities and pair each entity with a Bootstrap color class (as a placeholder, I want custom classes for this eventually):

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

As you can see here, I return the list as a `json` string. Why, you may ask? Well, to be honest, that might change. But my big problem came when I tried to figure out how to store the color values in the database. Because it's a series of key-value pairs, it didn't seem well suited to live in my current `List` database. My solution, for now, is to convert it into a `json` string and store it in a single column:
{% highlight python %}
text_to_colors = db.Column(db.String)
{% endhighlight %}
...but honestly, I'm not sure. I did some googling and found [this answer](https://stackoverflow.com/questions/43494824/when-can-i-save-json-or-xml-data-in-an-sql-table) about whether or not this is best practice. It's possible I might need to go back and create a new database table that just stores these pairs, then links them to the relevant line, the same way that each line is linked to a relevant list. But it's starting to get really hierarchical, and... I don't know.

And then there's how I actually used the JSON data in the template. I converted each database object into a python class that I made specifically for the occassion:

{% highlight python %}
# class that takes the db Line object and turns it into a python class to pass to the template
class LineToPass:
    def __init__(self, list_line):
        self.full_text = list_line.full_text
        self.text_to_colors = json.loads(list_line.text_to_colors)
{% endhighlight %}

I then passed it into my template, like so:

{% highlight python %}
@main.route('/list/<string:hex_name>', methods=['GET', 'POST'])
def list_page(hex_name):
    glist = GList.query.filter_by(hex_name=hex_name).first_or_404()
    list_lines = Line.query.filter_by(list=glist).all()

    list_lines = [LineToPass(line) for line in list_lines]

    return render_template('glist.html', title="Your List", glist=glist, list_lines=list_lines)

{% endhighlight %}

...but again, maybe this isn't the best way to do it. I'm not thrilled about having to convert classes like this.

On the other hand...

It works.

![alt text](/assets/img/posts/app-2/list-colored.png)

You can see that the Named Entity Recognizer still isn't perfect; it didn't catch "flour" on the second line, for example. But it did catch "Baileys Red Velvet Liqueur," so maybe there's hope. And in any case, I want the user to be able to adjust the entities as well, which will be my next task.

And that, dear friends, is when I ran headfirst into my first real problem.

## The Abyss Requests Also

My next goal seemed deceptively simple. When uploading new list items into the program, I wanted to show the user what spaCy thought the ingredient/amount was, and give them the opportunity to adjust them if necessary. I suspected, after all, that I was never going to get my entity recognizer to 100% accuracy, and it just seemed like the right thing to offer.

I scratched my head for a little while, scanning the internet for some ideas as how to do this. I quickly came to the inescapable conclusion that I would need JavaScript.

I have had some experience with JavaScript, but not much, and to be honest I wasn't thrilled to reestablish that connection. I was pretty firmly in Python-mode, and taking the time to learn the basics of another language was a frustrating roadblock. But you've got to know JavaScript, I think, and at some point I would like to learn a proper frontend library like React, so hey, no time like the present, right?

And at first, it didn't seem like it would be that bad; after a quick internet refresher on the basics, I moved into jQuery, which I remembered some of from my old CS classes back in college. I had in mind a fairly simple test, to start with: I wanted the user to be able to click on the individual words in a recipe line, and change the color of the words. Then I wanted to be able to submit that change to the database, so that, if refreshed, the database would remember the changes. My program wasn't sophisticated enough to register something as an "ingredient" to the main list yet -- I don't even have a main list. But I figured that changing the color would be a good proof of concept, to show that I could transfer data this way.

That meant I was going to have to use some sort of AJAX functionality.

And I have to be honest for a second here: I think this process would have been much easier for me if I'd done what I did while learning Flask, namely, take my time and step through the documentation piece by piece while making example projects. And I still intend to do that, honest! But dammit, I'm not the most patient person by nature and I just wanted to dip my toes into this to get it working.

I'll spare you the sordid details of my fight with jQuery, but suffice to say it's a fisherman's tale for the ages. Perhaps I should have captured it in the moment, but like the Old Man and the Sea, I have rowed back to shore with only the skeleton to show for my efforts. But hey, at least the skeleton works.

Behold:

{% highlight javascript %}
  $(function(){
    var word_buttons = $('.word-button')
    var hex_name = $('#hex-name').text()
    console.log(hex_name)

    word_buttons.click(function(){

      $( this ).toggleClass('hidden')

      var line = $( this ).parent()
      var line_id = line.attr('id')
      var children = line.children()

      var button_colors = {}

      for (var i = 0; i < children.length; i++){
        button_text = $(children[i]).text()
        button_color = $(children[i]).attr('class')
        button_colors[button_text] = button_color
      }

      var data = {'hex_name': hex_name,
                  'id': line_id,
                  'text_to_colors': JSON.stringify(button_colors)}

      console.log(data)

      $.ajax({
        type: 'POST',
        url: $SCRIPT_ROOT + '/list/set_color',
        data: data,
        dataType: 'json',
        success: function(jsonData){
          console.log(jsonData)
        }
      })
    });
  });

{% endhighlight %}

See what I mean? It's not so bad *now....*

The first thing you'll notice here is that I changed my goal from changing the color to toggling whether or not a word would appear. Of course, since after it vanishes you can't click it, this was essentially a one-way toggle, but at that point I was kind of beyond caring. You get to a point where you just want the damn thing to *work*, and you'll clean up the carnage in your wake later.

*(Not shown: a dozen `console.log` commands I deleted for the sake of readability.)*

All this script really does is get all the buttons (I changed the `<span>`s to `<button>`s for ease of clicking) and assign a `.click()` function to them. This function determines the parent line of the button and collects all of the class attributes into a JavaScript object. It then sends it to a `'/list/set_color'` route (which I'll be getting to in a moment).

That's it! That's all it does. And you would think this was not hard. But let me tell you, when you're a newborn babe wandering the dark forests of JavaScript, you tend to get stymied on the littlest things, including, but not limited to:

* how do I define a function?
* do I have to iterate through all the buttons, or will jQuery do that for me automatically?
* how the $#@^ does `this` work, anyway?
* do I need semicolons?
* when do I need parentheses, and when am I good?
* do I need to import anything?

... and so on and so forth. Maybe it's not the wisest move to admit all the little hangups I got caught on, considering this is supposed to be a place where I put my best foot forward. But I've got to be honest about it. And the good news is that I know how to do this now, so (*hopefully*) moving forward with simple JavaScript should not be a three-day pileup. Once I get this thing prototyped, I'll go back and make it look prettier, but I'm not trying to get my JavaScript certification right now. I'm just trying to get the damn thing to work.

And does it? Well, hold on there, eager beaver, we're still not quite done!

Check out the server side of this whole affair:

{% highlight python %}
@main.route('/list/set_color', methods=['GET', 'POST'])
def set_color():
    glist = GList.query.filter_by(hex_name=request.form.get('hex_name', '', type=str)).first_or_404()
    new_colors = request.form.get('text_to_colors', '', type=str)

    list_line = Line.query.filter_by(list=glist, id_in_list=request.form.get('id', 0, type=int)).first_or_404()
    list_line.text_to_colors = new_colors
    db.session.commit()

    return jsonify(new_colors)
{% endhighlight %}

Nothing too complicated here. It just takes the JSON information and searches out the proper list and line in the list, changing the color text to the new information that the client provided. In practice, this will never change more than one button at a time, because every click sends a new request, but the current structure of the database makes it easier for me to just update the whole line. At least, for now. Also note that the return value there doesn't actually do anything at the moment; I just wanted to be able to print the return data so that I could see it working.

And does it work? Well...

![alt text](/assets/img/posts/app-2/list-missing.png)

Indeed it does. This list I got after clicking a few of the words and then refreshing the page. Note the lack of anything to be "juiced" on line six, and the lack of quantity of "angel hair pasta" on line 1.

Now, this might not look like much, and it's true that this doesn't directly fix my main problems, but it's still a vital proof of concept. The user can now edit the list of ingredients, and have those edits be saved in real time to the database. That's a crucial feature of my main workflow, and it means I'm one step closer to getting this machine off the ground.
