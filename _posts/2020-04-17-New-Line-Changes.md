---
layout: post
title: More Changes to the Lines... And Thoughts About Perfectionism
author: Steve
---

This wasn't quite the blog post that I wanted to make. After having written up the changes to the recipe adder screen, I had turned my attention to the list page, wanting to clean up a number of built-but-rickety features and give the page a much-needed tune-up. One thing that I'd realized in the process of revamping the recipe adder page was that my understanding of CSS and how to lay out a webpage had grown by leaps and bounds since I first started, and I was eager to apply those same principles to the main list page. I figured that I would work on this for a few days, then come out with a long post about all the different things I'd changed, and then gear up for some final bug fixes for the final release.  

But this post isn't quite that post. That post is still coming; it's halfway written and currently sitting pretty in my "drafts" folder. But it's not this post, because partway through my work on the list page, I realized that my implementation of marking out ingredients on the recipe lines had several notable issues, and my attempts to fix those issues forced me to rewrite more of the code base than I'd expected, and I think may have driven home an important lesson about perfectionism.

But first, the scene.

### A Hiccup in the Cleaned Lines

My changes to the list page started out well enough. I'll save most of the description on what that's going to look like for my next post, but suffice to say that I've been giving it a slick upgrade (that may or may not be heavily inspired by Trello's UI), and cutting out *a lot* of my tangled mass of HTML that was there before. The new page is simpler, more elegant, and I like it a lot.

However, in the process of implementing the inline edits to the recipe lines, I realized that my solution to having multiple ingredients in the same line did not allow for two adjacent ingredients to be selected. This was in fact baked into its design; all my too-clever-by-half code to create and join up the button groups that I'd spent so much time on last week actually inhibited my ability to implement this feature, since clicking on a word next to an ingredient group automatically added that word to the ingredient in question. Worse, this was complicated further by my desire to have inline edits to recipe lines, to allow a user to modify the ingredients in real time without having to return to the recipe adder page. I wanted to have the `CleanedLine` objects automatically split and recombine as necessary, but this was made much harder by the fact that combining and splitting lines felt much more cumbersome than I was expecting. More generally, I just didn't like how there was this hole in functionality; my brain immediately went to all the cases where an end user would try to add an adjacent ingredient, become frustrated with the process, and declare the app (and by extension, me) an utter failure.

No, this would not do at all. I decided that, before I continued work on the final list page revisions, I would need to modify my code to support adjacent ingredients. *This,* I told myself, would be the final changes to the recipe page functionality--then I could put it to bed for good.

My new concept for the ingredient lines involved different colored button groups, one for each ingredient. The user would be able to select which color they wanted to "paint" with, and then click/tap on the words to mark them as that color. All words of that color would then be considered part of one ingredient. On the list page, clicking on a line to edit would only show the ingredient associated with that line, and could then be easily edited without worrying about any other ingredients on the line.

There were a few issues with this approach that I wasn't quite sure how to solve, but I decided to plow forward regardless, thinking that they would resolve themselves in time. And they did, for the most part, just not in the way that I was expecting.

### The Code

First up, it was back to the recipe adder page. My goal here was to have a small toolbar that contained different colors to paint the lines with. The toolbar would scroll with the user and would stick at a certain point when the user scrolled high enough. I used the `card` class and the grid layout to construct a simple bar with three colors on it:

{% highlight html %}
<div id="ingredient-selector" class="p-2 mx-1 bg-info rounded align-middle row">
            <span class="color-instructions col-auto text-light">Ingredient selector: </span>
            <label class="color-label mr-1 form-check-inline col-auto">
                <input type="radio" name="color" value="ing-1" checked>
                <span class="color-radio shadow-sm" style="background: coral"></span>
            </label>
            <label class="color-label mr-1 form-check-inline col-auto">
                <input type="radio" name="color" value="ing-2">
                <span class="color-radio shadow-sm" style="background: darkorchid"></span>
            </label>
            <label class="color-label mr-1 form-check-inline col-auto">
                <input type="radio" name="color" value="ing-3">
                <span class="color-radio shadow-sm" style="background: forestgreen"></span>
            </label>
        </div>
{% endhighlight %}

This created a simple, functional toolbar:

![alt text](/assets/img/posts/multiple-ingredients/selector-bar.png)

Then, I added some javascript that would check the user's scroll position, and add a new class,  `sticky`, that kept the scrollbar in position.

{% highlight javascript %}
var selector = $("#ingredient-selector")
var offset = selector.offset().top


$( window ).scroll(function(){
  var win_offset = $( window ).scrollTop()

  if (win_offset >= offset){
    selector.addClass("sticky")
  } else {
    selector.removeClass("sticky")
  }

})
{% endhighlight %}

The `sticky` class was just a few lines to set the position to fixed and make sure it stayed in the right place and rendered above everything else.

{% highlight css %}
.sticky {
  position: fixed;
  top: 5px;
  z-index: 5;
}
{% endhighlight %}

This worked pretty well, but my next task was much harder: the buttons had to actually *do* something. I started by creating three new classes, named `ing-` 1 through 3, and gave them the same colors as the buttons.

{% highlight css %}
.ing-1 {
  background-color: coral;
}

.ing-2 {
  background-color: darkorchid;
}

.ing-3 {
  background-color: forestgreen;
}
{% endhighlight %}

I then rewrote the `btn-ingredient` class to function as a sort of "universal" class for all three ingredient types. I figured this would work because the program would still need to distinguish between ingredient words and regular words, and I liked the rounded corners styling that I'd incorporated.

{% highlight css %}
.btn-ingredient {
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

Of course, the next problem was that, because all the different ingredients still had the `btn-ingredient` class, the function I'd written to create the button groups bunched them all together. So I had to go through and rewrite *that* as well. At the same time, I snuck in a bit of refactoring; changing the function so that it changed only a single line, rather than looping through all the `rawline` classes. I did this to make it easier to use on my list page.

{% highlight javascript %}
function create_ingredient_groups(line) {
    current_group = $(button_group) // create button group div
    current_line = line
    var cur_group_color = ""
    line.children().each(function(){
      var next = $(this).next()
      if ($( this ).hasClass('btn-ingredient')){
        var button_reg = $( this ).attr("class").match(ing_reg)
        if(button_reg != null){
          var button_color = button_reg[0]
          if (button_color == cur_group_color) {
            // still in same group
            $(this).appendTo(current_group)
          } else {
              if (current_group.children().length > 0){
                // new button group, insert old and reset
                current_group.insertBefore($(this))
                cur_group_color = button_color
                current_group = $(button_group)
                current_group.append($(this))
              } else {
                // first button of new group
                current_group.append($(this))
                cur_group_color = button_color
              }
          }
        }

        if (next.length == 0){ // end of line
          current_line.append(current_group)
        }
      }
      else if (current_group.children().length > 0){
        // end of button group, insert into line
        current_group.insertBefore($(this))
        current_group = $(button_group) // reset group
      }
    })
}
{% endhighlight %}

This took a while, and there was a lot of scratching my head and trying to figure out what was wrong when buttons suddenly had all their classes stripped or were inserted in wacky places. But there was a silver lining to it: I had been dreading the *other* broken function in all of this, `update_ingredient_groups()` function that changed what buttons were inside and outside of the group. This one would have gotten considerably more complicated with the addition of multiple new button groups, but I realized that I didn't actually need it at all. Now that my `create_ingredient_groups()` function worked on a line-by-line basis, all I needed to do was strip away the old ingredient groups and run it again to update the line. And that's exactly what I did:

{% highlight javascript %}
function strip_groups(line){
  console.log(line)
  line.children(".btn-group").each(function(){
    $(this).children().unwrap()
  })
}
{% endhighlight %}

I could have done this before (and saved myself a lot of headache with the nearly-100 line function I'd built), but hey. You live and learn.

Next, however, was a still harder task: I needed to rewrite the code that actually parsed the recipe lines, meaning I would have to deal with spaCy for the first time in months. The problem was that my old code wasn't equipped to differentiate between more than one ingredient. Parsing the lines could split the ingredients by detecting that there was a non-ingredient word in between then, but removing that word meant I could no longer rely on this. The *other* problem was that ingredient words now had two classes associated with them: the old `btn-ingredient` class, and a new one, identifying which ingredient they were a part of.

My solution was to create a new list, containing the three new classes. The function then checks if an entity is an ingredient, and if it is at the beginning of the ingredient entity (using the [IOB](https://spacy.io/usage/linguistic-features#named-entities) scheme), looping through the ingredients as necessary.

{% highlight python %}
line_ingredients = ["ing-1", "ing-2", "ing-3"]

def color_entities_in_line(line, line_colors=line_colors):
    cur_ingredient = -1
    in_ingredient = False
    color_tuples = []   # list of tuples of token and the color
    doc = nlp(line)
    for token in doc:
        print(token.ent_iob_)
        if token.ent_type_ == "INGREDIENT":
            if token.ent_iob_ == "B":
                cur_ingredient += 1 if cur_ingredient < 3 else 0
            color_tuples.append((token.text,  "btn-ingredient " + line_ingredients[cur_ingredient]))
        else:
            color_tuples.append((token.text, line_colors["O"]))


    return json.dumps(color_tuples)
{% endhighlight %}

This also effectively meant that the tuples now had two classes associated with them, but I could split them up fairly easily.

Next, I had to rewrite the function that turned the raw line data into ingredients that the `CleanedLine`s could use. This function was more complicated, because it needed to deal with a situation where two adjacent ingredients were next to each other. Ultimately, I scrapped the old boolean test to see if a word was in an ingredient or not, and instead opted to hold the class of the current ingredient and compare it to the class of the word being checked.

{% highlight python %}
# method that takes in json data from line colors and returns tuple of (amount, measurement, ingredient)
def extract_ingredients(color_string,
                        ingredient_color="text-success",
                        cardinal_color="text-warning",
                        quantity_color="text-primary"):
    ingredients = []    # list of ingredients in the line
    measurement = ''    # not currently used
    amount = 0          # not currently used
    color_dict = json.loads(color_string)
    current_ingredient = ''
    ingredient_class = ''
    for word, classes in color_dict:
        colors = classes.split()
        print(colors)
        # check the length of the colors because otherwise removing a button from an ingredient will throw an error
        if line_colors["INGREDIENT"] in colors and len(colors) > 1:  # we're in an ingredient
            if ingredient_class == colors[1]: # we're already in the ingredient
                current_ingredient += word + ' '
            else:   # new ingredient, check if coming from adjacent or not
                if not ingredient_class:
                    # we're starting an ingredient
                    current_ingredient += word + ' '
                    ingredient_class = colors[1]
                else:
                    # new, adjacent ingredient
                    current_ingredient = word + ' '
                    ingredient_class = colors[1]
        else:  # not in ingredient
            print("length of current is ", len(current_ingredient))
            if len(current_ingredient) > 0:
                # we ended an ingredient, need to add it
                current_ingredient = ''
                ingredient_class = ''  # reset the class

    if current_ingredient:  # end of line
        ingredients.append((current_ingredient, ingredient_class))


    return amount, measurement, ingredients

{% endhighlight %}

I'm still not using amount and measurement, and should probably get rid of them at some point. But by now I was realizing that I had bitten off more than I could chew, and just needed to get to a point where my program worked again.

On to the actual parsing of the cleaned lines. I added two new attributes to my `CleanedLine` model. The first, `rawline_index`, was the index of the `CleanedLine`'s particular ingredient in the array that `extract_ingredients()` returned. The second, `ingredient_color`, was the class of the ingredient. I needed this when changing the ingredient on my line page.

{% highlight python %}
for line in rlist_lines:
    print(line.text_to_colors)
    amount, measurement, ingredient_tuples = extract_ingredients(line.text_to_colors)
    for index, ingredient_tuples in enumerate(ingredient_tuples):
        print(index, ingredient_tuples)
        ingredient, color = ingredient_tuples
        if ingredient not in ingredient_dict:


            cleaned_line = CleanedLine(amount=amount,
                                       measurement=measurement,
                                       ingredient=ingredient,
                                       list=current_list,
                                       index_in_list=current_list_length,
                                       rawline_index=index,
                                       ingredient_color=color)
            current_list_length += 1  # add one to get the new length of the list

            db.session.add(cleaned_line)
            db.session.commit()

            line.cleaned_lines.append(cleaned_line)
            ingredient_dict[ingredient] = cleaned_line
            db.session.commit()
        else:
            line.cleaned_lines.append(ingredient_dict[ingredient])

{% endhighlight %}

Why did I need this on my line page? Because I didn't have the ingredient selector div there. I decided that including it (and, by implication, the opportunity to dynamically split lines) would introduce even more complication into what I was already realizing was an overly complicated process. So instead, I had each individual line contain knowledge of what color to use, and passed that value in when changing the ingredient.

Then, I had to write the code to modify the cleaned lines on the list page. I made use of the `rawline_index` attribute, and changed all the `CleanedLines` associated with the `RawLine` each time it was changed. This prevented overlap, which currently would not be supported (since the program has no way to differentiate between ingredients if there are two ingredient classes).

{% highlight python %}
@line.route('/line/set_color', methods=['GET', 'POST'])
def set_color():

    print(request.form)
    cur_line = RawLine.query.filter_by(hex_id=request.form.get('rawline_id', '', str)).first_or_404()

    # get ingredients before changing so that we can compare (performance hit?)
    amount, measurement, old_ingredient_tuples = extract_ingredients(cur_line.text_to_colors)

    new_colors = request.form.get('text_to_colors', '', type=str)
    cur_line.text_to_colors = new_colors
    db.session.commit()
    print(cur_line.text_to_colors)

    # check if we have a cleaned line as well
    print(request.form.get('cleanedline_id'))
    cline_to_change = CleanedLine.query.filter_by(hex_id=request.form.get('cleanedline_id')).first()
    clines_to_change = cur_line.cleaned_lines
    if clines_to_change:
        amount, measurement, ingredient_tuples = extract_ingredients(cur_line.text_to_colors)
        for cline, tup in zip(clines_to_change, ingredient_tuples):
            print(cline, tup)
            cline.ingredient = tup[0]  # change the ingredient to the new one
        db.session.commit()

        changed_lines = {cline.hex_id: cline.ingredient for cline in clines_to_change}

        return jsonify(changed_lines=changed_lines)

    return jsonify(new_colors)
{% endhighlight %}

Notice here that I returned the `hex_id` and new ingredient lines. I did this so that the client could automatically change the lines, rather than needing to refresh the page like it did before. The `send_line_data()` function can now check if there are `CleanedLine`s associated with the changed `RawLine` and update the data if so:

{% highlight javascript %}
// check if we have a cleaned line and if so add it
  line_id = $( button ).parents('.full-line').attr('id')
  if (line_id != null){
    console.log(line_id.slice(5, 16))
    data['cleanedline_id'] = line_id.slice(5, 16)
  }
  console.log(line_id)

  $.ajax({
    type: 'POST',
    url: $SCRIPT_ROOT + '/line/set_color',
    data: data,
    dataType: 'json',
    success: function(jsonData){
      strip_groups(line)
      create_ingredient_groups(line)
      console.log(jsonData)
      if (jsonData['changed_lines'] != null){
        // we have lines to change
        for (var changed_line in jsonData['changed_lines']){
          // iterate through and change the values
          $("#line-" + changed_line).find(".ingredient-name").text(jsonData['changed_lines'][changed_line])
        }
      }
    }
  })
{% endhighlight %}

So, what was the result of this quixotic journey through all of my supposed-to-be-about-to-launch code?

![alt text](/assets/img/posts/multiple-ingredients/new-adjacent-ingredients.png)

There. You can now have multiple ingredients on the same line, and the ingredients can be adjacent to each other. Of course, "chopped red" is not an ingredient, but it still works as proof of concept. In a hypothetical situation where there were multiple ingredients right next to each other, the user could select them as separate ingredients without much hassle.

Only... how often will that happen? Sure, it might happen occasionally, but part of the point of having recipe *lines* is that there is generally only one ingredient on each line. This is something of an edge case, at best. An edge case that I spent over 10 hours adding, bending my brain in knots to make it work.

Now, don't get me wrong, there are better ways to implement this, and I think working through this has made me a better programmer. But at the same time, I'm already a week past my deadline, and new features keep popping up and wanting to be added. What's going on here?

Honestly, I think I'm nervous. I know that it will soon be time to show this to other people, and I've never done that before. My perfectionism is kicking into overdrive, and I'm grappling with the need to make it perfect before other people can see it, to make it as impressive as possible. But of course, such things are arbitrary. It will never be "perfect" because there will never be a time when *some* little aspect of it doesn't keep bugging me.

And that's a problem because I can envision a situation where little things keep popping up and demanding my attention, and I put off a release for a bit longer to fix this, then that, and all the while I'm getting a bit more burned out, and it's a bit harder to boot up the program, and shiny new project ideas keep attracting more and more of my attention...

So I made a resolution. "Completeness" is somewhat arbitrary, right? Then I'm going to say version 1 is complete. I have a small list of bugs to fix, but dammit by the end of the weekend this program is going online. I can add post-release fixes later, but I am not going to let this gather dust.
