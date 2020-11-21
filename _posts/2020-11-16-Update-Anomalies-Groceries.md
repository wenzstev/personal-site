---
layout: post
title: Updates - Anomaly Frontend and SousChef Demo
author: Steve
excerpt_separator: <!--more-->

---


It's been a busy November here in the coding mines. <!--more--> In keeping with my new philosophy of blogging, I'm trying to post less frequently and focus more on actually getting new projects and apps out the door. But I've got a couple of new things out now, and I'm pretty excited about them.

### Anomaly Finder Frontend

Yes, the Anomaly Finder frontend is finished, and the project is hosted! You can check it out [here](https://anomalies.stevenwenzel.com/). I had some fun with the introduction; it's the first time I've tried any kind of digital storytelling and I wanted something to set the scene. Overall I'm quite pleased with how it came out; it really makes me wish that I had learned about Styled Components earlier. They would have worked much better for my other projects, and I think I'll be using them much more in my future React projects.

As it stands, you can enter anomalies and browse through ones that others have already entered. I have a very simple save and voting system that is implemented through the browser's local storage (at some point I may devote a future blog post to integrating local storage and React). This is really the most simple, barebones implementation of this concept that I could come up with right now, but I'm still pleased with where it is. In the future, I would love to come back to this and expand it into a proper collaborative storytelling project.

### SousChef Demo

As for the other piece of news, I have modified [SousChef](https://souschef.stevenwenzel.com) to allow some features to be used outside of the register wall. In retrospect, it was a *huge* mistake to lock the project that I've worked the hardest on and am the most proud of behind an email sign up. I wanted to prove that I could do it, but in practice it just means that no one is going to see it. So these modifications are my first step in fixing that.

Unfortunately, the project was built from the ground up with user accounts in mind, and so stripping them away is going to take a while (not to mention I'm deleting months' worth of work... lesson learned). But for now I've essentially added a backdoor into the recipe parser, so that people can submit recipes for parsing without needing an account. Currently an account is still needed to build a grocery list, but making the necessary changes in that department is going to take a while. I'm going to be switching back and forth from working on this project to working on other things, because to be honest I'm kind of sick of working on this project. But I've got a lot of ideas for a what a third version of this project would look like, and if I ever get the energy to revamp it, I think I could make it pretty damn good.

In the meantime, however, enjoy the modifications I've made, and stay tuned as I've got a lot if interesting stuff coming down the pipe!

Steve
