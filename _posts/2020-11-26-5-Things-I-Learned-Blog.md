---
layout: post
title: 5 Things I Learned Giving My Blog A Facelift
---

As you may have noticed, things look a bit different around here, and it's a long time coming. <!--more-->

When I first began to blog I knew very little about web development and didn't want to interrupt my Python work to learn. So I picked a layout someone else had made and called it a day. And for the past 11 (!) months I've been hammering away at it.

It's been a stalwart companion on my journey to learn software development, from my shaky [command line days]({% post_url 2020-01-17-Recipe-Parser-Part-1 %}) to my [first stab at a web app]({% post_url 2020-02-10-Grocery-App-Pt-1 %}), [discovery of React]({% post_url 2020-05-30-Calculator-Part-1 %}), and more comprehensive work on a [frontend and backend structure]({% post_url 2020-07-16-Grocery-App-Frontend-1 %}). I've talked about my [successes]({% post_url 2020-09-12-Its-Out %}) and my [failures]({% post_url 2020-04-24-That-Was-Hard %}), and I'm glad to have it as a record.

But the blog was shaky and it didn't really feel like mine. As part of my current push to consolidate my online presence, a rework was necessary. Here are a few things I learned in the process.

### 1. Pick the Right Tools for the Job

Now, I know what you're thinking: "Steve, didn't you just build a portfolio site?" And you're right. I did. [You can read about it here]({% post_url 2020-10-03-Update-Post %}).

But it wasn't very good. I was determined to prove that I was a Real Web Developer who Knew His Stuff, and I threw in so many bells and whistles that the whole thing started to look like [the car Homer Simpson designed that put his brother out of business](https://en.wikipedia.org/wiki/Oh_Brother,_Where_Art_Thou%3F).

![Homer's disasterous car](/assets/img/posts/the-homer-inline4.jpg)

Relevant information was difficult to find and organization was nonexistent. The whole thing was built in React with Material-UI, totally unnecessary for what should be a static site. I didn't even use Gatsby.

This site, on the other hand, is built with 100% grass-fed HTML and CSS, with a little sprinkle of JavaScript for pizzazz. It loads much faster, is much leaner, and tells an overall better story of who I am and what I can do.

You've always got to pick the right tools for the job. Don't use a Cadillac to haul freight, and don't use an SPA framework to build a static site.

### 2. Vanilla JavaScript can be Fun

Wait, where are you going? Stick with me for two seconds, I'll be quick, I promise.

But not as quick as vanilla JavaScript! [It's a lean, mean, performant machine.](https://gomakethings.com/just-how-much-faster-is-vanilla-js-than-frameworks/) It's also much faster on the setup. No compiler, no bundler, just you and a text editor and a dream.

Of course there are many, many issues with vanilla JavaScript. Everything can take so long and writing a million `document.getElementById()` and `appendTextNode()` can be a huge pain in the ass.

But there's a simplicity to it that's hard to match, and there's something very satisfying for me about just opening a text document, writing a few lines of code, and having it *do something.*


### 3. Don't be afraid to start from nothing

My first attempt at restarting this blog featured the [Jekyll quick start](https://jekyllrb.com/docs/), but I soon found I didn't like it. It included a lot of stuff I didn't want or need. So I ended up wiping it and truly [starting from scratch](https://jekyllrb.com/docs/step-by-step/01-setup/), with nothing but Gemfile and index.html.

It was a bit more work, but the end result feels like *mine* in a way that using the quick start doesn't. I had complete control over how all of the HTML, CSS, and JavaScript was implemented, and I drew a craftsman's satisfaction from that.

It's like the difference between buying a table kit and visiting the lumber yard. Sometimes you just want to cut the boards yourself.

### 4. How You Present your blog content Matters

You may have noticed this post is a bit different than what I normally write. That's because I'm trying to get with the picture. Over the course of moving my old posts over to the new site, I did a bit of reading on what makes for engaging blog content. Spoiler alert: it's not my stuff.

My previous posts have been loaded down with huge paragraphs and bloated explanations that were difficult to read; even my own eyes just slide over them.

So I'm limiting the size of my paragraphs to make them easier to read. I also added larger margins around the text for desktop, simulating a mobile experience.

### 5. Your actual blog content matters, too

This blog has served as a technical diary of my work, and to that end I think it's been decent. But it's done nothing to showcase my writing abilities. I mean, I'm supposed to be an English major here.

Partly that's because I've tried to spend as little time writing as possible so I could get back to coding, but it's also just because I didn't really know what to write. And, well, I still don't, but I think this might be a better direction to go in.

Talking about what I've learned, how I market myself, how I stick to a regular coding routine, all feel more productive and interesting than just writing about my latest implementation of a [Flask backend]({% post_url 2020-05-04-Schemas-Part-1 %}). Not that I don't want to write about what I'm coding, but I'm going to try to limit that a bit more.

I still don't really know what I want this blog to be and where I want it to go, but it's been a long neglected aspect of my online presence, and I want to take some steps to change that. This feels like a good start.
