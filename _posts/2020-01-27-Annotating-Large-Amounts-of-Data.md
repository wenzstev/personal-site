---
layout: post
title: Building a Command Line App to Annotate Large Amounts of Data
author: Steve
---

In order to properly teach spaCy a new entity type, we need a lot of data. SpaCy's documentation notes that "a few hundred would be a good start." I'm not the biggest fan of going through hundreds of lines of data and hand typing `{entities: (0, 12, 'QUANTITY')}` or whatever until my fingers bleed. So in the spirit of automation, I decided to write a command line app to do most of the work for me.

I planned out the app to work as follows: I would feed in a list of ingredient lines, and it would cycle through them one by one. On each line, it would then prompt the user to type out what the ingredient (or other entity) was. It would then search the line and match the entity, and return the start and end locations of the entity. Finally, it would wrap all of the necessary data in the right format, so when I was done I could just plug it into spaCy and run it.

When I'm starting a new project, even a relatively small one like this, I find it helps me a ton if I sketch out the flow first. So I wrote this as a scaffold:

{% highlight python %}
# training set: the list of ingredient lines
# entity_type: the string category of the entity (i.e., 'INGREDIENT')
def main(training_set, entity_type):
    # TODO: check if the training set is already formatted properly

    # TODO: loop through all lines in the training set

    # TODO: prompt the user to say what the entity is

    # TODO: check that the user's input matched part of the string

    # TODO: if not, prompt the user again

    # TODO: if so, record the input as the entity and move to the next example

    pass

{% endhighlight %}

Then (in a perfect world, at least), completing the program is as simple as going down the list and plugging it all in.

### Checking/Prepping the Training Set

Because I wanted this app to work on more than one type of data, (i.e., an unformatted list or an already formatted and partially annotated list), I needed to the program to first figure out what kind of data it was dealing with. This was accomplished with a simple `isinstance` check:

{% highlight python %}
# check if the training set is already formatted properly
   is_formatted = isinstance(training_set[0], tuple)  # TODO: more rigorous checks for alternate data types
{% endhighlight %}

If the inputted training set is already formatted, then this returns true. Otherwise, it returns false. I added a note here to make this more complicated for a future expansion (such as handling JSON or other formats), but for my purposes this works fine now. All I need is a simple check to access the raw text, be it in list form or annotated form:

{% highlight python %}
for line in training_set:
       if is_formatted:
           raw_text = line[0]
       else:
           raw_text = line
{% endhighlight %}

So far, so good.

### Having the User Input the Entity
Next, I wanted to print the line and prompt the user to type what the entity was. Additionally, I wanted the program to be complex enough to handle more than one entity on a line, or no entities on the line. It would also need to recognize if the user inputted something that *wasn't* on the line (such as a typo), notify the user, and reissue the prompt. Because I needed to potentially loop as many times over this part of the text as necessary to produce a result the program could understand, I decided to move it to a secondary function: `entity_search()`. This function would either return a list of tuples containting the start and end characters for each inputted entity, `False` if the inputted entity was not found, or `True` if the user inputted nothing (indicating that there were no entities on that line). Then, I could call the function as many times as necessary before it returned either the list, or `True`:

{% highlight python %}
found_entities = entity_search(raw_text)
while not found_entities:  # repeat the function until all matches are found
            found_entities = entity_search(raw_text)
{% endhighlight %}

In the `entity_search()` function, I first printed the line then prompted the user to enter the entity. If the user inputted nothing, I returned `True`:

{% highlight python %}
def entity_search(line):
    found_entities = []
    print(line)
    # TODO: prompt the user to say what the entity is
    line_entity = input("Enter the entity (or leave blank if none):")

    # check if user entered nothing
    if not line_entity:
        print("entered nothing. returning")
        return True
{% endhighlight %}

If the user did enter entities, I then split the input by `', '` in order to support multiple lines. If I want to support inputting entities with commas, this will have to be changed, but it should be trivial to sub out a different character in the future.

Then I looped through each split input and compiled a `regex` object with the input, using it to search the line. If the `regex` found the entity, then I appended my `found_entities` list with a tuple containing the start and end position of the match.

{% highlight python %}
entities = line_entity.split(', ')  # supports more than one entity, demarcated by ', '
   for entity in entities:  # loop through all entities and see if they match
       entity_regex = re.compile(entity)
       entity_match = entity_regex.search(line)
       if entity_match:
           found_entities.append((entity_match.start(), entity_match.end()))
{% endhighlight %}

Finally, I checked the length of the `found_entities` list with the length of the `entities` list I had looped over (the one created by separating entries with `', '`). If these lists did not match, then at least one of the entered entities was a typo, and so I returned `False`, indicating that the function would be run again. Otherwise, I returned `found_entities`.

{% highlight python %}
if len(found_entities) == len(entities):  # if we found all the typed entities
    return found_entities
else:
    return False
{% endhighlight %}

The function was then looped until it returned an acceptable result, which was then ready for formatting.

### Formatting the Entries for spaCy

The hard part was done; now that I had the start and end indicies for my entity, all I had to do was attach the entity tag to each one, and I had my spaCy formatting. Two things I had to keep in mind, though: the program needed to check if the user had inputted nothing (indicating no entities in the line), and it needed to check if there was already a dictionary of entities (if the user had inputted a partially annotated list).

I already knew to expect a result of `True` if the user returned no entries, so a quick `isinstance` check solved my first problem. The second issue was also easy: I had already determined if the list was annotated or not, so I added a quick line to add all entities from the annotated list, if it existed. I then appended my new `training_data` list with the new annotations:

{% highlight python %}
annotated_entity_list = []
       if not isinstance(found_entities, bool):
           annotated_entity_list = [(entity[0], entity[1], entity_type) for entity in found_entities]
       if is_formatted:
           annotated_entity_list.extend(line[1]["entities"])

       complete_training_data.append((raw_text, {"entities": annotated_entity_list}))

{% endhighlight %}

(Recall that `entity_type` was a variable I passed into the main function.)

Once these lines were in, I added a `return` line to return the `complete_training_data` list, and my main funciton was complete.

### Saving and Testing
Finally, I added a few lines to save the annotated data using the `pprint` module:

{% highlight python %}
with open('combined_data.py', 'a') as data_file:
    pp = pprint.PrettyPrinter()
    data_file.write("new_annotated_data = " + pp.pformat(new_annotated_data))
{% endhighlight %}

Before creating a longer training set, I tested it with a few recipe lines that I'd made up before. And I am delighted to say that it worked beautifully:

{% highlight python %}
new_annotated_data = [('1 cup flour, sifted', {'entities': [(6, 11, 'INGREDIENT')]}),
 ('1 teaspoons sea salt', {'entities': [(12, 20, 'INGREDIENT')]}),
 ('1 egg', {'entities': [(2, 5, 'INGREDIENT')]}),
 ('1/2 cup milk', {'entities': [(8, 12, 'INGREDIENT')]}),
 ('1 rounded tablespoon baking powder', {'entities': [(21, 34, 'INGREDIENT')]}),
 ('2 tablespoons olive oil', {'entities': [(14, 23, 'INGREDIENT')]}),
 ('3 cups lightly toasted sesame seeds',
  {'entities': [(23, 35, 'INGREDIENT')]}),
 ('1 (8 oz) package ground beef', {'entities': [(17, 28, 'INGREDIENT')]})]
{% endhighlight %}

### Final Thoughts

With a few minor changes, this program feels like something that a lot of people would find useful. It streamlines annotation into a very simple command line action, and takes care of most of the annoying detail that no one likes to mess with. When I have a little bit of time, I'm going to go back through and clean this up a bit and turn it into a standalone project. I would need to add more customization and a way to annotate text that was longer, but none of that is very hard. I'm quite proud of this project, and with this in my pocket it should be pretty easy to annotate all the data I would need to train my `INGREDIENT` entity. 
