---
layout: post
title: Cleaning Up the Recipe Page
author: Steve
---

For my first round of polishing changes, I returned to the recipe page, where things were *sort of* working, but in definite need of love. I hit several different areas, and the page is pretty close to where I want for first release (alpha?) now. Let's walk through the changes real quick.

### New Algorithms for Line Parsing

Previously, the code for moving from how the backend understood line/ingredient associations (start-end tokens), to how the frontend understood line/ingredient associations (individually labelled words), was a bit convoluted and difficult to follow. Part of this is due to the complexity of the problem, but I thought that I could make it a bit simpler and easier to follow, which would help as I attempted to fix some of the bugs that were still in the system.

The first function I changed was `mapTextToIngredients`, which converted the backend-provided ingredients and tokens to a form the frontend can use. Previously, I had iterated through the array of words a single time, checking if each index was on or between a relevant token.

Now, however, I iterated *twice*, once through the ingredient list, and once through the word array. The first iteration places down the start, end, and single tokens. The second iteration fills in the gaps between them.

{% highlight javascript %}

// function which takes an array of ingredients with start and end tokens
// and returns an array noting the annotation status of each word in the line
const mapTextToIngredients = (arrayLength, ingredientArray) => {
  var mappedArray = new Array(arrayLength)
  if (ingredientArray.length < 1){return mappedArray} // return if no ingredients

  // iterate over ingredient array for first pass
  for(var i = 0; i < ingredientArray.length; i++){
    let cur_ingredient = ingredientArray[i]
    let [start, end] = cur_ingredient.relevant_tokens
    let color_index = cur_ingredient.color_index
    if (end - start == 1){ // single word ingredient
      mappedArray[start] = [color_index, "single"]
    } else {
      mappedArray[start] = [color_index, "start"]
      mappedArray[end-1] = [color_index, "end"]
    }
  }

  // iterate over created array and fill in the blanks
  var cur_ingredient = null
  for (var i = 0; i < mappedArray.length; i++){
    if (mappedArray[i] != null){ // see if we're going to start a new ingredient
      switch(mappedArray[i][1]){
        case "start":
          cur_ingredient = mappedArray[i][0]
          break
        case "end":
        case "single":
          cur_ingredient = null
      }
    } else if (cur_ingredient != null){ // we are inside an ingredient
      mappedArray[i] = [cur_ingredient, "inside"]
    }
  }

  return mappedArray
}
{% endhighlight %}

I like this more because the code is cleaner and easier to understand, since there are less nested `if` statements.

Next, I modified the even larger `setNewIngredientTokens` function, which determines the new layout of the line after an ingredient button is clicked. Most of my work here was in splitting the function into smaller functions, to improve readability of the code. I also switched my cumbersome `fetch` call to my new axios object.

{% highlight javascript %}
// function which creates the new ingredient tokens after a button is clicked
const setNewIngredientTokens = (buttonId) => {
  let [ingredientToModify] = ingredients.filter(element=>element.color_index == props.curColor)
  if (ingredientToModify != undefined){
    var [start, end] = modifyStartEndTokens(ingredientToModify, buttonId)
  } else {
    // creating new ingredinet
      var start = buttonId
      var end = buttonId + 1
  }
    // get other ingredients in line
    const newTextToIngredientArray = spliceNewIngredient(start, end)
    axios.put(`/lines/${props.line.id}/ingredients`, {
      "new_ingredients":newTextToIngredientArray
    })
    .then(resp=>props.changeLine(resp.data))
}

const modifyStartEndTokens = (ingredientToChange, buttonId) => {
  let [start, end] = ingredientToChange.relevant_tokens
  if (buttonId < start){
    start = buttonId
  } else if (buttonId >= end){
    end = buttonId + 1 // add one because end is exclusive in spaCy
  } else {
    // inside ingredient
    let disFromStart = buttonId - start
    let disFromEnd = end - buttonId - 1 // subtract one because end is exclusive
    if(disFromStart > disFromEnd){
      end = buttonId
    } else {
      start = buttonId + 1
    }
  }

  return [start, end]

}

const spliceNewIngredient = (start, end) => {

  const lineWithoutChangedIng = ingredients.filter(element=>element.color_index != props.curColor)
  const oldTextToIngredientArray = mapTextToIngredients(text.length, lineWithoutChangedIng)

  // overlay new ingredient on old array
  const newTextToIngredientArray = oldTextToIngredientArray.map(element=>{
    if (element !== undefined) {return element[0]}
    else {return undefined}
  })

  if(start != end) {
    for (var i = 0; i < newTextToIngredientArray.length; i++){
      if(i >= start && i < end){
        newTextToIngredientArray[i] = props.curColor
      }
    }
  }

  return newTextToIngredientArray
}
{% endhighlight %}

I also tried to limit some of my Java-style `for` loops in favor of `.map()` and `filter()`, which I felt were cleaner and easier to read in general. I didn't get rid of all of them, but I still think it's quite an improvement.

You may also notice that I've begun reverencing an attribute called `color_index` that is part of the `RecipeLine` retrieved from the backend. This is part of my latest changes to the backend, which now supports persistent colors, rather than dynamically coloring based on location in the line.

### Backend Changes

Recall that, previously, the color of a line was determined by the ingredient's place in the line: the first ingredient was always colored teal, the second was colored orange, and so forth. If an ingredient was defined before an already-existing ingredient in the same line, then the first ingredient would *become* the teal ingredient, and the already-existing ingredient's color would change to reflect that.

I didn't like this; it seemed unprofessional and confusing. I wanted each ingredient/line association to be paired with a specific color that wouldn't change.

And it turns out, I already have a structure for line/ingredient associations.

{% highlight python %}
# Represents an association between an ingredient and a recipe line
class LineIngredientAssociations(db.Model):
...
    color_index = db.Column(db.Integer, nullable=False, default=0) # the index of the color for the frontend
...
{% endhighlight %}

This is just a simple integer variable that references the array of colors in the frontend. This way, the backend doesn't need to know the *exact* color (making it much easier to change), and the frontend can easily understand what is expected of it. But it wasn't enough to simply define this additional value; I needed places where it would change according to both user input and automatic detection.

I started with the latter, because it was a pretty easy fix.

{% highlight python %}
def determine_ingredients_in_line(line):
    current_recipe_line = {
        "text": [],
        "ingredients": []
    }
    line_nlp = nlp(line)
    color_index = 0

    current_recipe_line["text"] = json.dumps([token.text for token in line_nlp])

    for ent in line_nlp.ents:
        if (ent.label_ == "INGREDIENT"):
            current_recipe_line["ingredients"].append({
                "ingredient": {"name": ent.text},
                "relevant_tokens": json.dumps((ent.start, ent.end)),
                "color_index": color_index
            })
            color_index += 1

    return current_recipe_line
{% endhighlight %}

When using the spaCy library to parse a new ingredient, there's no user input on the colors, so I just kept the initial order in the line. Each time an ingredient is found, the `color_index` variable is incremented, ensuring that each ingredient on the line has a different value.

I then made some changes to the function that parsed the frontend data for new ingredient associations. I also did a bit of refactoring work to make it more readable.  

{% highlight python %}
def get_new_ingredients_on_line(new_ingredient_json, line_to_change):
    cur_ingredient = ""
    cur_ingredient_id_ = None
    start = 0
    ingredient_list = []

    line_word_list = json.loads(line_to_change.text)

    for index, (ingredient_id_, word) in enumerate(zip(new_ingredient_json, line_word_list)):
        if ingredient_id_ is not None:
            # we are in an ingredient
            if cur_ingredient_id_ is None:
                # starting new ingredient
                start = index
                cur_ingredient += word + " "
                cur_ingredient_id_ = ingredient_id_
            elif cur_ingredient_id_ != ingredient_id_:
                # we are changing from one ingredient to another
                ingredient_list.append(
                    {"ingredient": {"name": cur_ingredient},
                     "relevant_tokens": (start, index),
                     "color_index": cur_ingredient_id_})
                cur_ingredient += word + " "
                start = index
                cur_ingredient_id_ = ingredient_id_
            else:
                cur_ingredient += word + " "
        elif cur_ingredient_id_ is not None:
            # we just ended an ingredient
            ingredient_list.append(
                {"ingredient": {"name": cur_ingredient},
                 "relevant_tokens": (start, index),
                 "color_index": cur_ingredient_id_})
            cur_ingredient = ""
            cur_ingredient_id_ = None

    if cur_ingredient:
        ingredient_list.append(
            {"ingredient": {"name": cur_ingredient},
             "relevant_tokens": (start, len(line_word_list)),
             "color_index": cur_ingredient_id_})

    return json.dumps(ingredient_list)
{% endhighlight %}

There's at least one more thing I'd like to do here: the `ingredient_list.append()` call happens more or less identically in three different places and takes up four lines per place. Creating a small function to do this work would probably make the code a bit more legible. It's something I would like to go back to in my final pass, but honestly at this point I'm just completely sick of this part of the project. The recipe and ingredient line associations are swimming around in my head and sometimes it feels like I can't make heads or tails of them at all anymore.

### Editing Titles of Lists and Recipes

In between my work on the above, I took care of a quick issue which has been bugging me for a while: the inability to alter the names of recipes and lists.

I solved this by creating a quick, reusable component that made use of the `TopSquiggle` and `BackButton` components, and combined them with a new call to the api. This prevented passing of unnecessary props between the components and made them more reusable. I added a `type` prop to map onto the url of the api call to make the component more reusable.

{% highlight javascript %}
const EditableTitle = (props) => {
  const [title, setTitle] = useState()
  const {resourceId} = useParams()
  const classes = useStyles()

  useEffect(()=>{
    axios.get(`/${props.type}s/${resourceId}`)
    .then(resp=>setTitle(resp.data.name))
  }, [])

  const postNewTitle = () =>{
    axios.put(`/${props.type}s/${resourceId}`,{
      name: title
    })
    .then(resp=>console.log(resp.data))
  }

  const keyPressed = (e) => {
    if(e.key === "Enter"){
      e.preventDefault()
      postNewTitle()
      e.target.blur()
    }
  }


  return (
    <TopSquiggle>
      <BackButton />
      <InputBase
        className={classes.title}
        value={title}
        onChange={(e)=>setTitle(e.target.value)}
        onBlur={postNewTitle}
        onKeyPress={(e)=>{keyPressed(e)}}
        multiline/>
    </TopSquiggle>
  )
}

export default EditableTitle
{% endhighlight %}

This component works very similar to its predecessor in my first version of this project; it sends a call when focus leaves the object or when the "Enter" key is pressed. I wanted to make manipulations as easy as possible, and I'm pleased to report that this part was created without a hitch.

### Next Steps

Still plenty more to do, unfortunately. I want to revamp the Grocery List page and alter the styles around in order to give the first release a more polished look. I also need to create a title and explanation page for how the site works, and write up better documentation (or even just documentation at all). I would also like to look into some simple animations, although that's something I would pretty much need to learn from scratch.

But hey, I've learned everything else here from scratch; what's one more?
