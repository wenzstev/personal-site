---
layout: post
title: Enter Flask!
author: Steve
---

So it's been a little while since I wrote a blog post, and I figured it was time to make a little note of what I've been up to. Long story short, I've been spending my time learning Flask through a fantastic tutorial series by Corey Schafer. This [Python Flask Tutorial](https://www.youtube.com/watch?v=MwZwr5Tvyxo&list=PL-osiE80TeTs4UjLw5MM6OjgkjFeUxCYH) has done an absolutely fantastic job at introducing me to the basics of web app design, and I've been enjoying going through the process with his examples.

Why am I learning Flask, you may ask? Excellent question, and the long and short of it is that I've decided to build a web app to host the trained ingredient NER model that I've been developing, and turn my little project into a proper flagship portfolio piece. My goal is to have a simple app that allows users to provide recipe urls, extracts the ingredients from them, and consolidates them into a single grocery list, essentially the same as what my original command line application would do.

To that end, I've been learning Flask. I wasn't sure at first if I wanted to build this app with Django or Flask, but I chose the latter because it is simpler and has a less involved startup process. I'm still not convinced how involved I want to make the app, but I'm thinking basic [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) functionality. I would like for users to be able to share their grocery lists, and for lists to be saved and edited later. Additionally, I would like to make it as easy as possible for a user to correct any errors that the spaCy model cooks up; it's unlikely that it's going to read the ingredients 100 % of the time, and I want it to be easy to adjust ingredient lines as necessary. I would also like to offer the choice to combine like ingredients. Ideally, this would be a quick app that takes about five minutes to consolidate all recipes, then you can print it and you're ready to go.

I don't have much else to say at the moment, but I'll be blogging my progress on the Flask app as I go. I chose not to blog the tutorial series I was learning from, mainly because the app I created is exactly the same as the tutorial and I felt like my time was better spent learning. But now that I'm back to building my own stuff (at least for now), expect more frequent blog posts again.

And with that, I'm off to code. Catch you later.
