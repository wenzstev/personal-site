---
layout: post
title: A Road Map for the Future
author: Steve
---

As I mentioned yesterday, I wanted to take a moment of time to slow down and plan where I want this project to go. To be honest, this isn't something that comes particularly easy to me; I tend to jump into things headfirst and try to sort out a plan as I go. But for the past few weeks I've noticed a bit of a slowing to my approach to this project. Not quite procrastinating, but maybe a bit of stalling. I'd put my attention on one feature, finish it, and then kind of rest on my laurels for a little while, playing with it and patting myself on the back. It hasn't slowed down the project *too* much, but it's something I noticed and something that I want to nip in the bud.

I'm determined to finish this thing, or at least to get out a "version 1.0" that I can be happy with. I've got *lots* of ideas for it, many of which won't make it into this version. I concieved of this as a small project to teach myself Flask and the basics of web app design, and it's grown to become something more. So I want to get it to a point where I can show it to others and say, "hey, I made this, check it out, it's cool." And then I want to do just that, host it somewhere and see what people think. And maybe down the road I'll come back to it and add in some of the more "reach" features that have been bouncing around in my head. But for now, let's figure out what "v1.0" is going to need.

First, I sketched out some vague ideas on my whiteboard.

![alt text](/assets/img/posts/plan-for-future.jpg)

My handwriting is of course terrible, but I find that I tend to think better standing and it was good to get a bunch of stuff out. Here's an annotated list of everything I came up with, complete with notes and a (*very*) rough estimate of how long I think each piece will take. Note that I'm estimating in "sessions," which is basically my way of saying "the two to three hours I have each morning to work on this thing."


#### List Page
1. rename list
 - the ability to rename the list, self explanatory
 - *estimated time: one session*
2. check items off list
 - give the user the ability to "check" an item off, causing it to grey out and not be printed or exported. can be toggled.
  - *estimated time: one session*
3. delete items from list
  - the ability to delete an item from the list permanently. need to double check that the user wants to do so
  - *estimated time: one session*
4. move list items around
  - the ability to click and drag an item on the list to change the order, to make organizing grocery items easier
  - *estimated time: one session*
5. link to recipe if gotten from url
  - if the user got the recipe from a website, there should be a link to the recipe page that they can access
  - *estimated time: less than one session*

#### Clean List Page
1. delete lines from recipe
- when cleaning a list, the user should have the ability to completely delete a recipe line
- *estimated time: one session*

#### List Exporting
1. print to pdf
- the user should have the ability to create a pdf list that can be printed or downloaded
- *estimated time: 1-2 sessions*
2. other ways to export list
- the user should be able to have the list emailed to them
- possibly have the list texted to them? unsure
- possibly with facebook/social media?
- *estimated time: 2-3 sessions*

#### Accounts
1. accounts with username and password
- users should be able to create an account wiht a username and password. user can only edit their own lists
- *estimated time: 3 sessions*
2. "guest" lists
- if the user does not want to create an account, they can make a temporary list that will not be saved
- *estimated time: 1 session*
3. user "settings" page
- there should be a page where the user can edit their information and possibly other personalization features
- *estimated time: 2-3 sessions*
4. User homepage
- the user should have a homepage that lists all their lists (heh) and possibly other things, such as saved recipes
- *estimated time: 2-3 sessions*
5. user interaction?
- not sure about this, but maybe the option to copy another user's list (to create an editable copy) and maybe comments?
- *estimated time: 2 sessions*

#### Additional Time Allocations
1. bug fixing
- self-explanatory. I already have a few bugs, I should be writing them down as I go
- *estimated time: unsure*
2. make it look good/centralized theme and style
- everything is very generic and bootstrappy. I would like to give it a more unique style.
- *estimated time: 4-5 sessions*
3. host it
- need to figure out how I'm going to get the damn thing online
- *estimated time: 1-2 sessions*
4. unit testing?
- again, something I'm pretty unsure about, considering I've never done it. probably overlaps with bug fixing above
- *estimated time: who knows?*


**Total Estimated Time (roughly): 29 sessions**

And there you have it. If I can add all of these features, I will be proud to call my program "version 1.0." Note that these are *extremely* rough estimates of how long things will take; so far I have proven remarkably bad at knowing what things will be done quickly and what things will take a long time. But I'm going to estimate, at my current rate, another month before this thing is done. Considering it's taken me about a month so far (I first started on [February 10]({% post_url 2020-02-10-Grocery-App-Pt-1%})), I think that's a reasonable amount of time for an app this size on my first try. Of course, I honestly have no idea if that's true or not, but it's true for me, and I think that's what counts. So I'm going to make a personal goal for myself to have this thing out and online by April 9, 2020. As I go, I will make note of how long things are taking and adjust accordingly.

So there you have it! Tomorrow I will begin at the top of this list, and make my way down it until I'm done. Honestly I'm a bit antsy to get back in it, but I'm glad I took this little detour. It's always good to have a better grasp of where you're going. 
