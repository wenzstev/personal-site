---
layout: post
title: Building a Recipe Parser -- Part 2
author: Steve
---

When last we left our fledgling program, we had [planned our features and set up the basic scaffold]({% post_url 2020-01-17-Recipe-Parser-Part-1%}). Now, we turn our attention to the meat and potatoes of the program: getting the recipe, and parsing it out.

The first part proved to be the far easier of the two. I'd already decided to use a `beautifulsoup` module, and it was a cinch to go to a random recipe on [AllRecipes](allrecipes.com), and inspect the source to find out how ingredients were labelled. They use the name `recipeIngredient`, and in a couple lines of code my work was done:

{% highlight python %}
def parse_recipe(url):
  # capture webpage and open
  res = requests.get(url)
  soup = BeautifulSoup(res.text, 'lxml')

  # scan webpage for ingredients
  ingredient_lines = soup.find_all('span', itemprop='recipeIngredient')

  for line in ingredient_lines:
    # TODO: parse the line

    # TODO: add the item/amount to the list

    pass

{% endhighlight %}

Easy. Since `soup.find_all()` returns a list, I added a quick iterator and a few more `TODO`s. All was smooth sailing on the high seas, and I was feeling rather proud of myself. Which just goes to show, dear reader, that pride truly cometh before the fall.

#### Parsing Attempt 1: The Regex Debacle

My first attempt at parsing the lines involved a regex. It made sense to me at the time; regexes are good for capturing data when you know what the format is, and in general an ingredient line in a recipe follows a pretty standard pattern, something like:

* 1 cup flour
* 2 tablespoons salt
* 1 can tomatoes

With this format in mind, my first regex looked something like this:
```
(\d\/?\d?) ([\w]+) ([\w]+)
```
Which seemed to me a pretty simple way to capture all of the necessary information, and while I knew it wasn't going to be complicated enough to capture *everything*, I felt that it would be enough to get the majority of cases.

So I ran it through a couple of recipes and it pretty much immediately failed. This one can capture very simple ingredients like the ones above, but what about a two-word ingredient name?

* 1 tablespoon olive oil
* 1/2 teaspoon baking powder

*Okay,* I thought, *easy enough to fix. Just add a \s to the last capture group to catch everything after the measurement, like so:*

```
(\d\/?\d?) ([\w]+) ([\w\s]+)
```

This worked for the above, but what if there were extra words at the end of the line:

* 2 cups onions, chopped
* 1 can tomatoes, drained and cut into quarters

And what if there was no measurement amount:

* 1 egg
* 8 granny smith apples

And what if there were additional qualifying adjectives at play:

* 1 rounded tablespoon paprika
* 1 bunch Tuscan kale

And what if... and what if... and what if.......

And so played out the next two days of my life: working and reworking my little regex to make it impossibly flexible and intelligent. Looking at it now it's pretty obvious to me why it failed, and I attribute my initial belief that it would work to two things: the fact that I'm pretty new to regexes still, and the fact that I have a tendency to lose the forest for the trees, this one tree in particular. I'm a bit stubborn, and I don't like to admit when I'm beaten.

But beaten I was, and I finally had to turn to the internet for help. I made a [post](https://stackoverflow.com/questions/59686313/regex-for-recipe-ingredients-ignoring-adjectives-and-extraneous-words?noredirect=1#comment105544891_59686313) on Stack Overflow, describing my predicament and imploring the Old Masters there to teach me. I think it's telling that, at that point, I still thought that a regex would be the solution: I simply needed to find the right one.

They set me straight pretty quick.

#### Parsing Attempt 2: NLP to the Rescue
{: #nlp }
I was pretty much instantly advised to check out a natural language API. Natural language processing is something I'd heard about before, and was definitely on my list of things I wanted to learn, but it had always seemed extremely complicated, like magic, and frankly I was rather intimidated.

But I shouldn't have been, because the basics of NLP are actually fairly simple, and I am eternally grateful to the good folks at Stack Exchange for helping me see that, because wow, this stuff is so fascinating. The idea that you can write a program that can parse parts of speech, dependencies, tense, and so much more, and that you can use those things to effectively analyze data and extract information....

It's really cool.

I'll spare y'all the exact thought and learning process it took me to familiarize myself with the basics of NLP, but I want to give a shoutout to the tutorials and references I used:

* [A Practitioner's Guide to Natural Language Processing](https://towardsdatascience.com/a-practitioners-guide-to-natural-language-processing-part-i-processing-understanding-text-9f4abfd13e72) from Dipanjan Sarkar, which I tried to read first, bounced off of, then came back to later with a much better understanding of what was going on.

* [NLTK with Python 3 for Natural Language Processing](https://www.youtube.com/watch?v=FLZvOKSCkxY&list=PLQVvvaa0QuDf2JswnfiGkliBInZnIC4HL) from user sentdex was the most comprehensive one I could find, and was crucial in helping me understand most of the basic concepts (i.e., tokenizing, POS tagging, etc.). Even though it's for NLTK and I eventually went with spaCy, most of the concepts are the same and the theoretical background it provided was very useful.

* [Intro to NLP with spaCy](https://www.youtube.com/watch?v=WnGPv6HnBok&) from user Explosion taught me the basics of spaCy (including why it's a much better choice for someone like me who doesn't have as much theoretical background and isn't a researcher), and I was able to use a lot of the basic way he set up his program for my parser.

These three resources in particular gave me a crash course in the vocabulary and techniques of Natural Language Processing, and I'm very grateful to them for putting out this content. Without it, I wouldn't have been able to continue the recipe parser. I'm still extremely new at NLP, but I find the field fascinating and cannot wait to learn more. In my next post, I'll run through the model that I've constructed for parsing the recipe, and talk about how I could improve it for the future.
