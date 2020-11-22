---
layout: post
title: Finishing Touches on Writing Sprinter
author: Steve
---
This post is more of a final roundup of features and touch-ups I added to the writing sprinter, as well as a few things I had to take out to make it ready for first release. I'm definitely not done with this project yet, but the first version of it is complete and there are a lot of different things I need to split my attention between right now.

### API Integration
Recall that my original goal was to scrape images and quotes from online APIs, and combine them in ways that would (hopefully) stimulate the imagination of the user.

This actually proved to be a fairly easy task; there were several online APIs that looked promising, and it was simple to use a `fetch()` call to find the necessary materials. For example, here's a call I wrote that makes use of the MET (Metropolitan Museum of Art) API. Because the MET API returns a list of identification numbers when searched, I had to use two different calls. The first returns a list of potential pieces and picks one at random, and the second fetches the details of the chosen piece.

{% highlight javascript %}
useEffect(()=>{
  const urlParams = new URLSearchParams("")
  urlParams.append("q", "lillies")
  urlParams.append("isHighlight", "true")
  urlParams.append("medium", "Paintings")
  console.log(urlParams.toString())
  fetch("https://collectionapi.metmuseum.org/public/collection/v1/search?" + urlParams.toString())
    .then(res => res.json())
    .then(
      (result) => {
        const objectIDArray = result["objectIDs"]
        setImageID(objectIDArray[Math.floor(Math.random() * objectIDArray.length)])
      },
      (error) => {
        setIsLoaded(true)
        setImgJSON(error)
      }
    )
}, [])

useEffect(()=>{
  if (imageID !== undefined){
    fetch("https://collectionapi.metmuseum.org/public/collection/v1/objects/" + imageID.toString())
      .then(res => res.json())
      .then(
        (result) => {
          setImgJSON(result)
          setImage(result["primaryImageSmall"])
        }
      )
  }
}, [imageID])

return (
  <Grid item>
    <Box m={2}>
      <img src={image} height={200}/>
    </Box>
  </Grid>

)
{% endhighlight %}

The second `useEffect` call is triggered when `imageID` is changed in the first `useEffect` call, ensuring that the second hook is only triggered after the first.

Unfortunately, I soon realized that my brilliant plan to combine pictures and quotes did not in fact work out well in practice. For every combination that seemed thought-provoking or interesting, there were 10 that were just silly. Ultimately, I scrapped the pictures for now, although  would like to return to them. It seems like it could be a very interesting project to try and predict combinations that would be interesting or thought-provoking. Something for the future.

### Writing Quotes

My quotes were simpler to set up, but I had difficulty finding an online source that had what I wanted. I experimented a bit with a famous quotes API, but what I really wanted were quotes from literature, stuff that was open-ended enough to spark thought, and maybe also featured some good use of language. Ultimately, I couldn't find anything that was quite what I was looking for, and so I ultimately just compiled some quotes myself. I stored them in a JSON file and saved the text, the author, and the book:

{% highlight javascript %}
export const quotes = [
  {
    "text": "Maybe ever’body in the whole damn world is scared of each other.",
    "author": "John Steinbeck",
    "book": "Of Mice And Men"
  },
  {
    "text": "Life is to be lived, not controlled; and humanity is won by continuing to play in face of certain defeat.",
    "author": "Ralph Ellison",
    "book":"Invisible Man"
  },
  {
    "text": "Terror made me cruel",
    "author": "Emily Brontë",
    "book": "Wuthering Heights"
  },
  {
    "text": "Some men get the world, some men get ex-hookers and a trip to Arizona. You’re in with the former, but my God I don’t envy the blood on your conscience.",
    "author": "James Ellroy",
    "book": "L.A. Confidential"
  },
  //...and so on
{% endhighlight %}

I then changed around the prompt panel so that it would show the quote with scaling font size, to ensure a consistent panel. To do so, I used [react-textfit](https://www.npmjs.com/package/react-textfit).

{% highlight javascript %}
const TextPrompt = (props) => {
  return (
      <Box m={2} p={2} fontStyle="italic">
        <Box height={props.textHeight}>
          <Textfit mode="multi" max={30} style={{height: "100%"}}>
            "{props.quote.text}"
          </Textfit>
        </Box>
        <Box height={50} mt={2}>
          <Textfit mode="multi" max={20} style={{height:"100%"}}>
            - {props.quote.author}, {props.quote.book}
          </Textfit>
        </Box>
      </Box>
  )
}
{% endhighlight %}

This gave the panel a nice look.

![alt text](/assets/img/posts/writing-sprint/new-quote-panel.png)

I also adjusted some settings to make sure that the bar would look okay without a quote.

![alt text](/assets/img/posts/writing-sprint/new-timer-bar.png)

### A Note On Styling

Currently, my little app doesn't have a lot of style to it; it's still a fairly barebones. I played around with some styling and color changes, but everything I tried looked fairly amateurish. I'm chalking this up to a lack of experience on my part; I don't know much about UX design, and that's probably going to be one of the things I want to get better at going forward. One thing I would really like to add, however, is a selection of different themes, with interesting backgrounds for each one. I'd curate the themes, which would hopefully prevent some of the silly combinations that I was getting before, and maybe provide some of the inspiration I was going for. But for now, I'm keeping it simple.

Either way, the first version of this app is now live at wenzelstev.github.io/writingsprinter. You can check out the code [here](https://github.com/wenzstev/writingsprinter). Stay tuned for when I return to this one, as I think there is still a ton of untapped potential here.
