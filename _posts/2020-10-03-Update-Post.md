---
layout: post
title: Where I've Been
author: Steve
---

Well, it's been a little while since I last made an update here. <!--more--> I've got some new projects in the pipeline, so expect some posts about that coming soon. First, however, I want to talk a little bit about what I've been working on.

Presenting [stevenwenzel.com](stevenwenzel.com), my portfolio site! It's still got a lot of work to be done on it, but I wanted to have something out that I could put on job applications to show what I'm working on. The site is built with React and most of it is bog standard enough to not really warrant posts about it, but I do want to touch on one area that I made use of more extensively than I have in the past: a Redux store.

I liked the idea of giving visitors to the site something to "play with" to show off a little bit of frontend knowledge. What I landed on was a simple palette color change, where a user could click on several different buttons in order to try out different themes and backgrounds. I decided to incorporate Redux as a way to store all of the changes, and I structured my code so that the actual theme could be stored in a JavaScript object, minimizing the amount of code that would need to be rewritten.

Here's my Redux store:

{% highlight javascript %}
import {basicTheme} from "../Assets/ThemePacks"


const backgroundReducer = (state=basicTheme.background, action) => {
  switch(action.type){
    case "SETTHEME":
      return action.payload.background
    default:
      return state
  }
}

const headerReducer = (state=basicTheme.header, action) => {
  switch(action.type){
    case "SETTHEME":
      return action.payload.header
    default:
      return state
  }
}

// ... more of the same ...


const rootReducer = combineReducers({
  name: nameReducer,
  background: backgroundReducer,
  header: headerReducer,
  body: bodyReducer,
  input: inputReducer,
  buttons: buttonReducer,
  surfaces: surfaceReducer
})
{% endhighlight %}

Each piece of the reducer is named after a different stylistic change. Crucially, however, they all operate off of a single action, "SETTHEME". The payload of SETTHEME contains the actual styling differences. Here's the one for the default page:

{% highlight javascript %}
export const basicTheme = {
  name: "basic",
  background: forestBackground,
  thumbnail: forestBackground,
  frontPageLinkColors: {
    about: "#1C3C51",
    portfolio: "#546B86",
    blog: "#547484",
    contact: "#BFD3E5"
  },
  header: {
    color: "black"
  },
  body: {S
    color: "black"
  },
  input: {
    backgroundColor: "lightgray",
    borderColor: "black",
    borderColorHover: "darkgray"
  },
  surfaces: {
    backgroundPanel: {
      backgroundColor: "rgba(255, 255, 255, .8)"
    },
    cards: {
      backgroundColor: "#dfe8f2"
    }
  }
}
{% endhighlight %}

These are then inserted as inline CSS for the various components that require them.

This isn't a huge feature and there are certainly ways I could shrink the code in the future. But one nice thing about it is that I can hypothetically create as many themes as I want and swap them out whenever; now that the boilerplate is in it's simple to make variations. But at the same time, I'm not sure how long I'll be keeping this version of the portfolio site, so I didn't want to spend too much time on it if it was only going to be a temporary thing.
