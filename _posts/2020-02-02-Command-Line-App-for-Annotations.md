---
layout: post
title: A Command Line App to make Annotating spaCy Data Easier
author: Steve
---

Well, this took a bit longer than I wanted it to, but I'm very pleased with the results. I present to you the [spaCy NER Annotator](https://github.com/wenzstev/spaCy_ner_annotater), a command line version of the annotator helper that I made a few posts back. This is a version that's cleaned up from my personal files and made into a form that hopefully others can use. It's also a personal follow-up on a goal to learn `plac` as well as introducing several new Python concepts to me.

And let me tell you, this thing was more of a pain than I thought it would be. Because I wanted to be able to both annotate new data and add annotations onto partially annotated data, I needed the program to be flexible in its input. Interestingly, the easiest part by far was reading raw lines of text from a .txt file; the hardest by far was doing the same from a .py file. For way too long I couldn't figure out how to import a module without knowing it's name; I didn't even know if that was possible. Learning the `inputlib` module fixed this issue for me, but I still had the issue of allowing the user to dynamically choose the list they wanted to add. This required *more* dynamic input, and I don't want to bore you with the number of different `eval` and `exec` lines I tried before finally getting it right. Dynamic programming in general is a new concept to me, and one that I'm eager to learn more about. I want to thank the wonderful people at StackOverflow; time and again I'm blown away by the rapidness and quality of the help that's provided there.

Anyway, the actual script is pretty simple, and although I'd like to maybe add some more features later, it can be run now. You can annotate the same list as many times as necessary to get all the different entities. It's not much, but it's the first thing I've made with the intention of sharing with others, and I'm rather proud of it.

Now, if you'll excuse me, I'm off to annotate several hundred examples in preparation for the next phase of my recipe project. Stay tuned!
