---
layout: post
title: Finally Fixing the "Add Line" Feature
author: Steve
---

#### Refactoring to List instead of Dictionary

Okay, time for Part 2 of fixing the "Add Line" feature. First, I needed to do the restructuring I mentioned in my last post, and alter the code so that lists, instead of dictionaries are sent through the ajax requests. I first did this by changing the `color_entities_in_line()` function to return a json array:

{% highlight python %}
def color_entities_in_line(line, line_colors=line_colors):
    color_tuples = []   # list of tuples of token and the color
    doc = nlp(line)
    for token in doc:
        if token.ent_iob_ == "O":   # if the token is outside an entity
            color_tuples.append((token.text, line_colors["O"]))
        else:
            color_tuples.append((token.text, line_colors[token.ent_type_]))
    return json.dumps(color_tuples)
{% endhighlight %}

Then I changed the JavaScript in the "Add Line" feature to iterate through the new nested array:

{% highlight JavaScript %}
for (var i in jsonData['parsed_line']){
      clean_line.append("<button class='" + jsonData['parsed_line'][i][1] + " word-button'>" + jsonData['parsed_line'][i][0] + "</button>")
    }
{% endhighlight %}

This meant that the line finally showed up again, and now had a guaranteed order.

![alt text](/assets/img/posts/recipe-line-fix/order-works.png)

Wonderful.

I also needed to alter the ajax on the client side, so that it submitted a list back instead of a dictionary. This was important because otherwise the lists that already existed would be replaced by dictionary objects as the function ran.

{% highlight javascript %}
for (var i = 0; i < children.length; i++){
  button_text = $(children[i]).text()
  button_color = $(children[i]).attr('class').match(patt)[0]
  console.log(button_color)
  button_colors.push([button_text, button_color])
}
{% endhighlight %}

But not quite done. Now I needed to go back and fix the other place where this code runs: the "Clean List" page. This actually proved much easier than I thought, and was as simple as modifying the code to iterate through a list instead of a dictionary:

{% highlight html %}
<ul class="list-group">
        {%raw%}{% for line in rlist_lines %}{%endraw%}
        <div class="list-group-item btn-group" id="{%raw%}{{ line.id_in_list }}{%endraw%}">
            {%raw%}{% for token, color in line.text_to_colors %}{%endraw%}
                <button class="{%raw%}{{ color }}{%endraw%} word-button" >{%raw%}{{ token }}{%endraw%}</button>
            {%raw%}{% endfor %}{%endraw%}
        </div>
        {%raw%}{% endfor %}{%endraw%}
    </ul>
{% endhighlight %}

Gotta love Python.

This made the code that I'd already written work properly again. Now, it's time to fix the "Add Line" feature, for real this time.

#### The New Add Line Function

First, I added a few extra lines of code to the "parse_line" route in my `main.routes` file:

{% highlight python %}
@main.route('/clean/parse_line', methods=['GET', 'POST'])
def parse_line():
    new_line = request.form.get('line_text', '', type=str)
    parsed_line = color_entities_in_line(new_line)

    new_raw_line = RawLine(id_in_list=-1, full_text=new_line, text_to_colors=parsed_line)
    db.session.add(new_raw_line)
    db.session.commit()

    amount, measurement, ingredient = extract_ingredients(new_raw_line.text_to_colors)
    cur_list_hex = request.form.get('compiled_list', '', type=str)
    cur_list = CompiledList.query.filter_by(hex_name=cur_list_hex).first_or_404()

    new_cleaned_line = CleanedLine(amount=amount,
                                   measurement=measurement,
                                   ingredient=ingredient,
                                   list=cur_list)
    db.session.add(new_cleaned_line)
    new_raw_line.cleaned_line=new_cleaned_line
    db.session.commit()

    return {'line_id': new_raw_line.id,
            'parsed_line': json.loads(parsed_line)}  # have to load it to make sure it's formatted properly for client

{% endhighlight %}

This creates a new `CleanedLine` object and assigns the `RawLine` object to it. I decided to do it here in order to make the ajax work easier on the client side for the next step. Also note that I added the `hex_name` of the current list I was on to the ajax request, which enabled me to access the right list on the server side.

It was here that I ran into a sort of conundrum: how to request the individual ingredient lines without them having a recipe to help with the lookup process? Here, I admit, I kind of went in circles for a bit. First, I modified the "/clean/set_color" route, as it is currently set to need the `hex_name` of the recipe in order to find the right line. I changed it so that it instead uses the unique `id` of the `RawLine`, which is passed through the ajax request. I then use the `RawLine` to call the `CleanedLine` associated with it (which I'd already created in the "parse_line" route):

{% highlight python %}
@main.route('/clean/set_color', methods=['GET', 'POST'])
def set_color():
    print(request.form.get('line_id'))
    cur_line = RawLine.query.filter_by(id=request.form.get('line_id', -1, int)).first_or_404()

    print(cur_line)

    new_colors = request.form.get('text_to_colors', '', type=str)
    print(request.form.get('text_to_colors'))
    print(request.is_json)
    print('new colors', new_colors)

    cur_line.text_to_colors = new_colors

    amount, measurement, ingredient = extract_ingredients(cur_line.text_to_colors)
    cur_cleaned_line = CleanedLine.query.filter_by(id=cur_line.cline_id).first_or_404()
    cur_cleaned_line.amount = amount
    cur_cleaned_line.measurement = measurement
    cur_cleaned_line.ingredient = ingredient

    db.session.commit()

    return jsonify(new_colors)
{% endhighlight %}

This works, and in general it seems to me to be a better way to look up the `RawLines`; there's less database querying and it's guaranteed to find the right match. There's just one problem: changing the code like this breaks (once again) the code for the "clean line" page. I knew this going in, but had decided that it would be better to rewrite the "clean recipe" page so that it ran off of the individual `id`s as well.

I also did it because I wanted to implement a version of my in-line recipe cleaning for the main recipe page. Instead of the "Edit" button redirecting to the whole recipe page, it seems easier and more intuitive for it to show the buttons in the line, so that they can be adjusted as necessary. Clicking "commit" would then refresh the page, with the necessary changes made.

But first, I had to come up with a better, more generalized solution to the ajax requests for the line colors. The simplest thing to do seemed to just create an `id` attribute that matched the `id` of the `RawLine` in the database. Then a simply jQuery command would be able to fetch it and send it as part of the ajax call. But... I don't know, I felt uncomfortable including the actual raw `id` like that, it seemed... unsafe? Admittedly, I don't have any information for that besides a vague hunch, but I still didn't want to do it. Besides, using a number as an HTML `id` attribute doesn't feel like best practices.

What I ended up doing was creating a custom `id` attribute for each  `RawLine`. This `id` was created by combining the `hex_name` of the `RecipeList` and the `id_in_list` of the `RawLine`. Sounds like a bit of a tongue twister, but here's what it looks like in code:

{% highlight html %}
{%raw%}{% if line.raw_lines %}{%endraw%}
    <div class="list-group collapse" id="{%raw%}{{line.ingredient_id}}{%endraw%}">
        {%raw%}{% for raw_line in line.raw_lines %}{%endraw%}
          <div class="list-group-item list-flex" data-toggle="collapse" id="{%raw%}{{raw_line.recipe.hex_name}}{%endraw%}-{%raw%}{{raw_line.id_in_list}}{%endraw%}">
            <div class="recipe-info">
              <span class="dot" style="background-color:{%raw%}{{raw_line.recipe.hex_color}}{%endraw%}"></span>
              <div class="recipe-line recipe-div">"{%raw%}{{raw_line.full_text}}{%endraw%}"</div>
              <div class="recipe-name recipe-div">{%raw%}{{raw_line.recipe.name}}{%endraw%}</div>
            </div>
            <div class="button-panel recipe-div">
              <button class="edit-button">Edit</button>
            </div>
          </div>
        {%raw%}{% endfor %}{%endraw%}
      </div>
{%raw%}{% endif %}{%endraw%}
{% endhighlight %}

Then, I rewrote the code in the `get_colors()` and `set_colors()` routes to take either the `id` of the `RawLine` OR the `hex_name` and `id_in_list` attributes. This ensured the maximum flexibility of my code, and I'm hoping that having more ways to get the information I need will make it easier down the line if I need to change anything.

{% highlight python %}
@main.route('/list/get_colors', methods=['GET', 'POST'])
def get_colors():
    # check if finding by line id or recipe hex
    line_id = request.form.get('line_id', -1, int)
    if line_id > 0:  # if we have a line id
        cur_line = RawLine.query.filter_by(line_id).first_or_404()
    else:  # we're finding it from a recipe hex
        recipe_hex = request.form.get('hex_name', '', str)
        recipe_line = request.form.get('recipe_line', -1, int)
        recipe = RecipeList.query.filter_by(hex_name=recipe_hex).first_or_404()
        cur_line = RawLine.query.filter_by(rlist=recipe, id_in_list=recipe_line).first_or_404()

    return {'line_id': cur_line.id,
            'parsed_line': json.loads(cur_line.text_to_colors)}



@main.route('/clean/set_color', methods=['GET', 'POST'])
def set_color():
    # check if we're finding by line id or by hex name
    # TODO: refactor code so that this section and the identical section in get_colors are in one function
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

    new_colors = request.form.get('text_to_colors', '', type=str)
    print(request.form.get('text_to_colors'))
    print(request.is_json)
    print('new colors', new_colors)

    cur_line.text_to_colors = new_colors
    db.session.commit()
    #  check if there is a cleaned line for this raw line yet
    if cur_line.cline_id:
        amount, measurement, ingredient = extract_ingredients(cur_line.text_to_colors)
        print('getting cleaned line:', cur_line.cline_id)
        cur_cleaned_line = CleanedLine.query.filter_by(id=cur_line.cline_id).first_or_404()
        # check if there is more than one raw line that points to this cleaned line
        # TODO: modify cleaned line code to check if there is more than one raw line (and split them if necessary)
        print(cur_cleaned_line)
        cur_cleaned_line.amount = amount
        cur_cleaned_line.measurement = measurement
        cur_cleaned_line.ingredient = ingredient
        db.session.commit()

    return jsonify(new_colors)

{% endhighlight %}

As you can see, there are still some `TODO`s that I've left in place here, mainly for refactoring code to improve readability. One thing that I do need to do, however, is modify the `set_color()` route in particular to split a `CleanedLine` if a change in the ingredients requires it. This is generally an isolated case, but it's still something that is going to need to be worked on.

Then, I rewrote a few lines of my jQuery code so that the function that enables the editable buttons in the main list works both for the "Add List" button and the "Edit" buttons on each line:

{% highlight javascript %}
function clean_line(jsonData, place_to_append){

    console.log(place_to_append)
    place_to_append.children('.recipe-info, .button-panel').hide()

    var compiled_list = $('#compiled-list')
    place_to_append.append("<div id='clean-line' class='btn-group'></div>")

    ...
{% endhighlight %}

There's obviously a lot more to this function, but the important things to note are that I added a `place_to_append` variable here that tells the function where to insert the buttons, and I search and only hide the information that appears on the `RawLine` objects underneath the `CleanedLine`s. Otherwise, if I was using the code for the "Add Line" button, the entire recipe list would disappear.

Then (yeah, we're *still* going), I changed the "Commit" button to a simple redirect to the same page, which allows the changes to be added to the page:

{% highlight javascript %}
$("#commit-new-line").append("<button id='commit-button' class='edit-button'>Commit</button>")

$("#commit-button").on('click', function(){
  window.location.href=$SCRIPT_ROOT + '/list/' + $LIST_HEX
})
{% endhighlight %}

Unfortunately, the edit command didn't work with the new lines, because they didn't have a recipe to create the id with. So I decided to do something that I probably should have done a long time ago: create a `RecipeList` for additional ingredients, and add all user-created lines to that list. In the code for the home page that creates a new `CompiledList`:

{% highlight python %}
user_added_list = RecipeList(name="Additional Ingredients",
                                     hex_name=secrets.token_urlsafe(8),
                                     hex_color="#D3D3D3",
                                     recipe_url="NA")
        user_added_list.complist = new_list
        db.session.add(user_added_list)
        db.session.commit()
{% endhighlight %}

Note that I picked my own `hex_color` for this, as I wanted it to be grey every time, to support a sense that this list was different.

The code successfully created the new list:

![alt text](/assets/img/posts/recipe-line-fix/additional-ingredient-recipe.png)

Now to add the code that actually adds the new lines to this recipe.

{% highlight python %}
cur_list_hex = request.form.get('compiled_list', '', type=str)
    cur_list = CompiledList.query.filter_by(hex_name=cur_list_hex).first_or_404()

    user_ingredient_recipe = RecipeList.query.filter_by(complist=cur_list, name="Additional Ingredients").first_or_404()
    user_ingredient_lines = RawLine.query.filter_by(rlist=user_ingredient_recipe).all()

    new_raw_line = RawLine(id_in_list=len(user_ingredient_lines)+1,
                           rlist=user_ingredient_recipe,
                           full_text=new_line,
                           text_to_colors=parsed_line)

    db.session.add(new_raw_line)
    db.session.commit()
{% endhighlight %}

![alt text](/assets/img/posts/recipe-line-fix/adding-lines-user-created.png)

And all the pieces are in. *Whew*, that took a while. As I let my smoldering fingers gently fall from the keyboard, I closed my eyes and whispered to whatever gods of coding exist, *"it is finished."*

Though, of course, it's not finished, at all. But this has been something that has stymied me for the better part of two weeks, and I'm very proud to have this functionality working.

What's next? Well, the first thing going to do next is some serious refactoring. My `main` blueprint is getting pretty large and unwieldy, and a large part of why I decided to use blueprints from the beginning was so that I could more easily refactor later. So I'm going to split up into several blueprints.

Then, I'm going to focus on a few small quality-of-life improvements. The CSS isn't quite right for some of the pages, and I'd like the barebones functionality to be a little prettier before I tackle the next big part of this project.

But these are mostly small things to give myself a breather before I move onto the next, very important steps:
1. A more fully integrated ability to get recipes from the web/add them yourself
2. Accounts, users, and some level of social functionality.

These are the last big things that I need to do on this project. Stay tuned to watch me tear my hair out as they prove much more difficult that I think they'll be (and I certainly don't think they'll be easy).

Until next time!
