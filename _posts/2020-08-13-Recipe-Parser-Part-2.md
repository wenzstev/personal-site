---
layout: post
title: Building the Recipe Page - Part 2
author: Steve
---

Well, this post has taken a bit longer to make than I'd expected, and that's because there's a *lot* of code today. It's taken me a while to wrangle this into working, and I definitely need a refactor at some point, but I wanted to make a post to show what I've got, because at the moment I'm just happy it's working.

Longtime readers will recall from my [first attempt]({% post_url 2020-04-17-New-Line-Changes %}) at designing the recipe cleaning page that I had a lot of trouble with the nitty-gritty details of customizing the ingredients associated with a line. That was due to two primary factors: 1) The problem is an inherently complex one, and 2) My code at that time was seriously flawed. Problem 1 is still an issue, but I was hopeful that, with a few extra months of practice under my belt (as well as a shiny new framework), Problem 2 would not be nearly as much of an issue.

And was it? Well, there's certainly room for improvement, but I think I did a much better job this time.

### The Problem

There are two data structures: `RecipeLines` and `Ingredients`, connected with a many-to-many relationship. Certain words on a `RecipeLine` are directly linked to an `Ingredient`. These relationships are initially determined by the Natural Language Processor, but they need to be editable by the user. The user edits them by clicking on words. Multiple `Ingredients` can be linked to a single `RecipeLine`, but the words have to be separate (i.e., the line "Extra virgin olive oil" can't have the ingredients "olive oil" and "oil", but it could have the ingredients "olive" and "oil").

This is a much trickier problem than I'd first anticipated, but I managed to get through it by breaking it down into smaller pieces and working through them one by one.

### Setting up the Page

First, I created the basic React components that would comprise my Recipe Page. I reused the `MainTemplatePage` and then created a `RecipePanel` to hold the actual lines.

{% highlight javascript %}
// EditRecipePage return function
return (
  <MainTemplatePage noSearchbar>
      <TopSquiggle>
        <BackButton />
        {recipe ? recipe.name : null}
      </TopSquiggle>
      <RecipePanel
        lines={recipe.recipe_lines}
        removeLineFromDOM={removeLineFromDOM}
        changeLine={changeRecipeLine}/>
  </MainTemplatePage>
)
{% endhighlight %}

 This panel was then composed of `RecipeLines`, which were themselves composed of `IngredientButtons`. Each individual word is a button, and they are determined by a `map()` call. There are a number of arrays and functions here that I haven't discussed yet, but ignore those for now.

 {% highlight javascript %}
 // RecipeLine return function
 return (
   <ListItem className={classes.root} onMouseEnter={()=>setHovering(true)} onMouseLeave={()=>setHovering(false)}>
     {text.map((word, index)=>{
       return(
         <IngredientButton
           index={index}
           key={index}
           mappings={textToIngredientArray[index]}
           colors={props.colors}
           clickHandler={()=>{setNewIngredientTokens(index)}}>
           {word}
         </IngredientButton>
       )}
     )}
     {hovering ? <RemoveLineButton removeLine={deleteLine}/> : null}
   </ListItem>
 )
 {% endhighlight %}

An `IngredientButton` is just a `ButtonBase` component from Material-UI, with a few stylings.

{% highlight javascript %}
// IngredientButton return function
return (
  <Box>
    <ButtonBase
      style={colorIndex != undefined ? {"backgroundColor": props.colors[colorIndex]} : null}
      className={buttonClasses}
      onClick={props.clickHandler}>
      {props.children}
    </ButtonBase>
  </Box>
)
{% endhighlight %}

This is the general structure of the page. There are other components, but they are mostly concerned with peripheral actions and we'll discuss them in time.

### Mapping Text to Ingredients

Recall that the backend does not give us every word in an ingredient, but rather just the start (inclusive) and the end (exclusive) points. From this, we need to generate a mapping of the status of every word in the line, so that its individual button knows what it's supposed to look like. We do this with a function, `mapTextToIngredients`, which takes in an `arrayLength` the length of the line and an `ingredientArray`, which is the ingredients on the line (not to be confused with the array of text of the line).

In designing this function, I wanted it to run in O(n) time and avoid nested `for` loops (which would have happened if I simply iterated over each array). Instead, I keep track of a which ingredient I am currently looking at. When that ingredient is finished, I can simply move to the next ingredient, since I know they have to be in order and cannot use the same word.

{% highlight javascript %}
const mapTextToIngredients = (arrayLength, ingredientArray) => {
  const emptyArray = new Array(arrayLength)
  if (ingredientArray.length == 0) {return emptyArray}
  var curIngredient = 0
  for (var i = 0; i < arrayLength; i++){
    if(ingredientArray[curIngredient] != null){
      const [tokenStart, tokenEnd] = ingredientArray[curIngredient].relevant_tokens
      if (i === tokenStart) {
        if (i === tokenEnd-1){
          emptyArray[i] = [curIngredient, "single"]
        } else {
          emptyArray[i] = [curIngredient, "start"]
        }
      } else if (i > tokenStart && i < tokenEnd - 1){
        emptyArray[i] = [curIngredient, "inside"]
      } else if (i === tokenEnd -  1){
        emptyArray[i] = [curIngredient, "end"]
      } else if (i === tokenEnd){
        curIngredient ++
      }
    }
  }
  return emptyArray
}
{% endhighlight %}

A couple of things to note here. The array that returns actually returns a second array of two values. One is the index ingredient for the color of the line (more on this later), and the other is a word indicating the position (if at all) of the word in the ingredient. This is necessary for styling the `IngredientButton` component, which has a number of custom styles depending on the button's position. Additionally, the array is constructed so that words that are not part of ingredients are just empty spaces in the array.

This function not only helps with mapping words to their ingredients, but it is also used when it comes time to change that relationship.

### Adding and Removing Words from Ingredients

Now we start to get to the trickier stuff. When the user clicks on a word, the program needs to understand which ingredient they are modifying and how they want it modified. For example, clicking on a word that is *inside* an ingredient is different than clicking on one that is *outside*. Furthermore, clicking on a different ingredient than the one currently selected should "paint over" that ingredient with the selected ingredient. At no time should one word have two ingredients associated with it.

After figuring out exactly what the user wants, the program then needs to repackage that information in a way the backend can understand. After sending it, the backend then needs to actually make the necessary changes to the underlying association.

It's a multi-step process, but it begins with the click.

{% highlight javascript %}
const setNewIngredientTokens = (buttonId) => {

  if (ingredients[props.curColor] != null){
    var ingredientToChange = ingredients[props.curColor]
    var [start, end] = ingredientToChange.relevant_tokens
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
  } else {
    // creating new ingredinet
      start = buttonId
      end = buttonId + 1
  }
    // get other ingredients in line
    const lineWithoutChangedIng = [...ingredients]
    lineWithoutChangedIng.splice(props.curColor, 1)
    const oldTextToIngredientArray = mapTextToIngredients(text.length, lineWithoutChangedIng)
    // overlay new ingredient on old array
    const newTextToIngredientArray = [...oldTextToIngredientArray]
    if(start != end){
      for (var i = 0; i < newTextToIngredientArray.length; i++){
        if(i >= start && i < end){
          newTextToIngredientArray[i] = props.curColor
        }
      }
    }

    const body = {
      "new_ingredients": newTextToIngredientArray
    }
    const headers = new Headers()
    headers.append('Authorization', 'Basic ' + btoa(token + ":"))
    headers.append('Content-Type', 'application/json')
    fetch(`/lines/${props.line.id}/ingredients`,{
      method:"PUT",
      body: JSON.stringify(body),
      headers: headers
    })
    .then(response=>response.json())
    .then(json=>{
      props.changeLine(json)
    })
}
{% endhighlight %}

This is a pretty meaty function, so lets break it down. First, the function figures out what ingredient it is modifying. This is stored as a piece of state in the `RecipePanel` component and passed down as props. The function then unpacks the original `start` and `end` values for the ingredient. It compares them to the `buttonId` of the button that was pushed.

The first two if statements concern what happens if the `buttonId` outside the old bounds of the ingredient; that is, it is either less than `start` or greater than or equal to `end`. In these cases, `buttonId` is simply swapped out with whichever token it is closer to.

The final `else` statement is used if the `buttonId` is inside the old bounds of the ingredient; that is, we need to shrink the ingredient. When this happens, the function figures out if the `buttonId` is closer to the beginning or the end of the ingredient. It then swaps out accordingly, biasing towards the end of the ingredient (which I picked more or less arbitrarily).

Now that the function has the new `start` and `end` values, it needs to actually change the ingredient. It does this by creating a new, spliced, version of the ingredient array (copied so as to prevent mutation of state). The `mapTextToIngredients` function is then called on this new array. Finally, the changed ingredient is overlaid onto the old ingredient array, creating the new version. This is what we send to the backend.

### The Backend

When the backend receives the array, it must still convert it into the new line association. It does this through a new function, `get_new_ingredients_on_line`, which takes the JSON data the frontend created and the line that needs to be changed.

{% highlight python %}
def get_new_ingredients_on_line(new_ingredient_json, line_to_change):

    new_ingredients = []
    cur_ingredient_index = None
    cur_ingredient = ""
    start = 0

    line_text_list = json.loads(line_to_change.text)

    for i, (word, ingredient_index) in enumerate(zip(line_text_list, new_ingredient_json)):
        print(i, word, ingredient_index)
        if ingredient_index is not None:
            # check if we are in a new ingredient
            if cur_ingredient_index is None:
                cur_ingredient_index = ingredient_index
                start = i
            elif cur_ingredient_index != ingredient_index:
                end = i + 1 # add one because spaCy end is exclusive
                new_ingredients.append({"ingredient": cur_ingredient.strip(), "relevant_tokens": (start, end)})
                cur_ingredient_index += 1
                cur_ingredient = ""
                start = i
            cur_ingredient += word + " "
        elif cur_ingredient_index is not None:
            new_ingredients.append({"ingredient":{"name":cur_ingredient.strip()}, "relevant_tokens":(start, i)})
            cur_ingredient_index = None
            cur_ingredient = ""

    if cur_ingredient:
        new_ingredients.append({"ingredient":{"name": cur_ingredient}, "relevant_tokens": (start, len(line_text_list))})

    return json.dumps(new_ingredients)
{% endhighlight %}

Let's go through this function. After defining a few initial values, the server iterates through an enumerated, zipped combination of the words on the line and the `ingredient_index` JSON. The `enumerate` addition is needed for the creation of indices.

For each word, the function checks if it is part of an ingredient. If so, it appends the word onto the current ingredient being created. Once the end of the ingredient has been reached, it appends the ingredient's start and end values, as determined by the `enumerate` call. It then returns a dumped version of the ingredients. Because these ingredients are compatible with the `RecipelineIngredientAssociationSchema` that I created [last time]({% post_url 2020-08-08-Recipe-Page-Part-1 %}), I can simply feed them in and the backend will take care of creating/associating the ingredients as necessary. The route then returns the new `RecipeLine`, ready for the frontend to update.

### Updating the Frontend

Updating the frontend is actually quite easy, although I may want to come back here later to improve the performance.

{% highlight JavaScript %}
const changeRecipeLine = (lineId, newLineJSON) => {
  const newLines = [...recipe.recipe_lines]
  newLines[lineId] = newLineJSON
  setRecipe({...recipe, ...{recipe_lines: newLines}})
}
{% endhighlight %}

This function makes use of object spread to create a new version of the recipe lines. It then swaps out the changed line and sets the recipe state to a new object, with the new version of the recipe lines. The problem with this is that it causes the whole recipe to re-render. So far it's not causing performance issues, but this whole section is probably due for a refactor at some point anyway, and I'll take another look at it then.

### Deleting a Recipe Line

I also included a simple function to delete a line from the recipe. It operates essentially the same way that modifying a line does, except it makes use of the `splice()` function to cut out the removed line.

{% highlight javascript %}
const removeLineFromDOM = (lineId) => {
  const newLines = [...recipe.recipe_lines]
  newLines.splice(lineId, 1)
  setRecipe({...recipe, ...{recipe_lines: newLines}})
}
{% endhighlight %}

The RecipeLine also sends a `fetch` request to actually remove the line from the database.

### Colors

The colors are stored in an array in the `RecipePanel` component:

{% highlight javascript %}
const colors = [
  "teal",
  "orange",
  "green",
  "red",
  "blue"
]
{% endhighlight %}

The current color is managed by a piece of state, also at this level. Users select different colors using the `ColorButton` component, which is held by the `ColorPicker` component.

{% highlight javascript %}
const ColorButton = (props) => {
  const classes = useStyles(props)
  return (
    <ButtonBase className = {classes.root} onClick={()=>props.setCurColor(props.colorNum)}>
      <Teardrop className={props.selected ? classes.selected : null}/>
    </ButtonBase>
  )
}
{% endhighlight %}

The `setCurColor` function changes the `curColor` state. When a new ingredient button is clicked, this is how the program knows what ingredient to modify. The color that is selected is visually represented to the user with the `selected` attribute.

### Conclusions

And that's most of it! There are a few other small additions I made, but I don't think they're important enough to take up space in this already fairly long post. That said, there's definitely some clean-up to do here. The whole thing could take a lot of polish, and I'd like to break up some of the larger functions into more manageable chunks. That said, I've been working on this nonstop for a week and I need a break. I plan to focus on some other aspects of the app now, namely the list page. Once I get that working properly, I'm going to give this thing a big round of polish and then hopefully push for first release. I'll keep adding features after, but I'm looking for a job right now and I want to have something to show prospective employers.

Until next time!
