---
layout: post
title: Building a Recipe Parser -- Part 3
author: Steve
---
*If you're looking for Part 1 of this writeup, please click [here]({% post_url 2020-01-17-Recipe-Parser-Part-1%}). If you're looking for Part 2, please click [here]({% post_url 2020-01-18-Recipe-Parser-Part-2%})*

In this post I'm going to explain Mark I of my NLP recipe parser. Full disclosure, it's a bit janky, but it gets the job done for now and was an excellent crash course in NLP basics. Please note that this isn't a tutorial on spaCy or Natural Language Processing; it's just a breakdown of the steps I took and how I made use of NLP to better parse my ingredient lists. If you're looking for a more in-depth look at how natural language processing works, you can refer to the list of resources in the bottom of my [previous post]({% post_url 2020-01-18-Recipe-Parser-Part-2%}). They're what I used, and I highly recommend them.

I started by creating a simple list of ingredients that I could pass through, rather than go through the trouble of opening a webpage every time I wanted to test something:

{% highlight python %}
test_recipe_text = ["1 cup flour, sifted",
                    "1 teaspoons sea salt",
                    "1 egg",
                    "1/2 cup milk",
                    "1 rounded tablespoon baking powder",
                    "2 tablespoons olive oil",
                    "3 cups lightly toasted sesame seeds",
                    "1 (8 oz) package ground beef"]
{% endhighlight %}

As you can see, I tried to add in a series of different problems for the parser to use, including lines that varied from the basic `amount measurement ingredient` format.

With these examples in hand, I was ready to begin.

#### Finding the Amount

The first step was to load up an NLP library and start passing it information. We can then iterate through each token in the phrase:

{% highlight python %}
nlp = spacy.load("en_core_web_sm")
for line in test_recipe_text:
  nlp_ing = nlp(line)
  for token in nlp_ing:
    # extract meaning here
{% endhighlight %}

Recall that I need to find three important variables:
* the ingredient
* the measurement
* the amount

I figured that the amount would be the easiest, since it is most likely going to come at the beginning of the phrase and would *usually* (but not always) be the only number in the phrase. A quick check to the token's parts of speech caught most numbers fairly quickly:

{% highlight python %}
if token.pos_ == 'NUM':
  self.amount = Fraction(token.text)
{% endhighlight %}

You can also see here that I'm using python's built-in `fractions` library, since I felt it kept everything more legible and was in keeping with the recipe theme in general.

#### Finding the Ingredient

Finding the ingredient was a little bit trickier, for several reasons. At first, I thought it would be as easy as checking the dependencies of the word for the subject of the sentence or the root. I would then check to make sure the word in question was a noun, and we would have our ingredient:

{% highlight python %}
if token.dep_ in ['ROOT', 'nsubj']:
  if token.pos_ in ['NOUN', 'PROPN']:
    ingredient = token.text
{% endhighlight %}

Again, this caught *most* of the ingredients, but not all of them, and I'm still not entirely sure why. I *think* it has to do, at least in part, with the fact that recipe lines don't necessarily use proper English grammar, and that was confusing the spaCy model. Ultimately, I had to add a few extra tags, including `dobj` and `appos` in order to catch some edge cases, but to be honest I'm still uneasy about this approach, because it feels kind of rickety. But I'm fast prototyping and trying to get something out, and this will do for now.

There is still a significant problem, however: as is now, this can only catch an ingredient if the ingredient is one word. Because we're scanning by token, an ingredient like `'olive oil'` won't be caught; the program will just read it as `'oil'`. To fix this, I had the program, once it found the noun base, scan the children of the word for compounds or modifications:

{% highlight python %}
for child in token.children:
  # sometimes the measurements are registered as children
  if not measurement_regex.match(child.text):
    if child.dep_ in ['compound', 'amod']:
      ingredient += child.text + ' '
{% endhighlight %}

One thing you'll note here is the use of a `regex`, which I'll be discussing momentarily. Suffice to say that the `regex` is being used to scan for measurement types.

The `regex` notwithstanding, the rest of the code is pretty self-evident. If the program thinks it found an ingredient, it checks the children of the token in question and scans for compounds or modifiers. If it finds any, then it adds them to the ingredient. This is, frankly, another example of the program seeming smarter than it really is, but what the hell, I'll take it (at least for now).

Putting it all together, we get:

{% highlight python %}
if token.dep_ in ['ROOT', 'nsubj', 'dobj', 'appos']:
  if token.pos_ in ['NOUN', 'PROPN']:
    # we have found an ingredient, so check children
    for child in token.children:
      # sometimes the measurements are registered as children
      if not measurement_regex.match(child.text):
        if child.dep_ in ['compound', 'amod']:
          ingredient += child.text + ' '
    ingredient += token.text + ' '
{% endhighlight %}

#### Finding the Measurement

Finding the measurement was pretty tricky, because spaCy pretty regularly confused the measurement with the ingredient. Turns out that something like `'cup'` or `'tablespoon'` are also nouns and sometimes have the same dependencies as the ingredients. This stymied me for a bit, and I became worried that the whole house of cards was going to be felled. However, I found a solution in the form of my old adversary: `regex`.

I decided that, before I checked the parts of speech or dependencies for an amount or an ingredient, I would run them through a regex to see if they were a measurement. This would take the measurements out of the pool of potential other choices, and ensure that the rest of my program only had to search for amounts and ingredients. The regex I used was simple:
{% highlight python %}
measurement_regex = re.compile('(cup|tablespoon|teaspoon|oz|pound|ounce|clove|cube)s?')
{% endhighlight %}

And then, all I had to do was check:

{% highlight python %}
if measurement_regex.search(token.text):
  measurement = measurement_regex.search(token.text).group(1)
{% endhighlight %}

This is very simple, so simple that it could probably be a list instead, so I will probably return to refactor this area. But again, for now, it works. Changing the other `if` statements to `elif`s ensured that a measurement token wouldn't be scanned for amount or ingredient, and I had the skeleton in place.

#### Edge Cases and Other Details

There were still a few small kinks to work out, which I found while testing my program. The first was that the amount was sometimes registered as a `'ROOT'`, `'nsubj'`, or other dependency that would be caught by the ingredient checker. The program was smart enough to realize that a number was the ingredient, but because of the `elif` statements, it then skipped the later number check. I solved this by adding an additional catch at the end of the ingredient checker:

{% highlight python %}
elif token.dep_ in['ROOT', 'nsubj', 'dobj', 'appos']:
  ...
  if token.pos_ == 'NUM':  #sometimes the amount is registered as nsubj
    amount = Fraction(token.text)
{% endhighlight %}

Another issue I found with the number checking was that spaCy would sometimes tag the number as `'X'` rather than `'NUM'` in its parts-of-speech tagger. I think, again, that this has to do with spaCy's model not quite knowing what to do with the unusual syntax of ingredient phrases, but again, it was an easy enough fix. Even though spaCy didn't recognize it as a `'NUM'`, it checked dependency correctly, so a few additional lines of code caught these outliers:
{% highlight python %}
elif token.pos_ == 'X' and token.dep_ == 'nummod':
  amount = Fraction(token.text)
{% endhighlight %}

Finally, I added a small check to remove water and salt from the ingredient lists, since presumably most kitchens have them.

{% highlight python %}
if token.lower_ in ['salt', 'water']:
  continue
{% endhighlight %}

#### Integrating the Parser by Making it a Class
Now that all of the pieces were in place, it was time to integrate the code into the main recipe parser. I decided to encapsulate the code into a few classes, to make importing as easy as possible. Specifically, I tried to follow spaCy's model in my class construction: just as you can load a spaCy model and then run various pieces of text through it, I wanted to be able to load my parser and then run various texts through it. I felt that this was the best choice of ease of use.

To that end, I created two classes, a `RecipeNLP` class that loaded spaCy, and a `ParsedLine` class, which the `RecipeNLP` class returned when the function `parse` was called. The logic for parsing the recipe was then stored in the `ParsedLine` class, to be called in `__init__`.

{% highlight python %}
class RecipeNLP:
  def __init__(self):
    self.nlp = spacy.load('en_core_web_sm')

  def parse(self, recipe_line):
    return ParsedLine(self.nlp, recipe_line)

class ParsedLine:
  def __init__(self, nlp, recipe_line):
    nlp_ing = nlp(recipe_line)
    self.measurement_regex = re.compile('(cup|tablespoon|teaspoon|oz|pound|ounce|clove|cube)s?')

    self.ingredient = ""
    self.measurement = ""
    self.amount = 0

    for token in nlp_ing:
      # all the logic for parsing the line goes here
{% endhighlight %}

This honestly worked even better than I'd hoped. In the main program, it was a cinch to create one `RecipeNLP` class and then pass through as many lines as necessary. In the main `GroceryListParser` class, it looked like this:

{% highlight python %}
from recipe_parser import RecipeNLP
...

def parse_recipe(url):
  ...
  nlp = RecipeNLP()

  for line in ingredient_lines:
    parsed_line = nlp.parse(line.text)
    ingredient = parsed_line.ingredient
    measurement = parsed_line.measurement
    amount = parsed_line.amount

{% endhighlight %}

This greatly simplified my code in the main program, and the modular design makes it so that I can easily refractor my code in the `recipe_parser` file, without worrying about anything in the main program being broken.

And I do plan to refractor that code.

#### Closing Thoughts

This is my first venture into Natural Language Processing, and considering that, I'm pleased with it. I feel like I was able to get the basics of how NLP works down, and certainly this program is head and shoulders above my previous `regex` attempts to parse ingredient lines.

That said, it's still pretty janky. There are a lot of things that *work* but kinda-maybe *shouldn't*, and I don't like that. I think my next step for improving this project would be to look into actually training a spaCy model specifically to recognize and parse ingredient lines.

Of course, the tragic truth is that, in programming, usually someone else has done it before. During the course of writing this, I did some googling and found this extremely intersting article from the New York Times Blog: [Extracting Structured Data from Recipes Using Conditional Random Fields](https://open.blogs.nytimes.com/2015/04/09/extracting-structured-data-from-recipes-using-conditional-random-fields/). Turns out they were doing pretty much the same thing as me, and they even posted their code up on [GitHub](https://github.com/nytimes/ingredient-phrase-tagger). However, I'm taking this as a learning experiment, and I think the next thing I'm going to do is look over their code and see if I can replicate it myself.
