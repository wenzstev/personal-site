---
layout: post
title: Cleaning Up the List Page
author: Steve
---

This is just going to be a quick post where I cover some of the changes I made to the List Page in preparation for first release.

### Creating a Recipe Panel

I wanted to provide additional information about the recipes that were in a given grocery list, as well as provide links to the editing pages and the original source of the recipe. I wanted this to function similarly to the panel as it worked in my first version of this project.

{% highlight javascript %}
const RecipePanel = (props) => {
  const [recipes, setRecipes] = useState([])
  const {resourceId} = useParams()

  const classes = useStyles()

  const getRecipes = () => {
    axios.get(`/recipes?list=${resourceId}`)
    .then(resp=>setRecipes(resp.data))
  }

  useEffect(()=>{
    getRecipes()
  }, [props.drawerOpen]);

  const refreshPanels = () => {
    props.getIngredients()
    getRecipes()
  }

  const mappedRecipes = recipes
  .filter((element)=>element.name != "Additional Ingredients")
  .map((element, index)=>(
    <RecipeButton
      recipe={element}
      key={index}
      refreshPanels={refreshPanels}/>)
  )

  const component = (
    <Grid item xs={12} md={6}>
      <Box m={1}>
        <Paper className={classes.root}>
          <List>
            {mappedRecipes}
          </List>
        </Paper>
      </Box>
    </Grid>
  )

  return (
    <>
    {mappedRecipes.length > 0 ? component : null}
    </>
  )
}

export default RecipePanel
{% endhighlight %}

The `RecipePanel` component uses an Axios call to get all recipes in the list, filters out the "Additional Ingredients" recipe, and then maps them to another new component, the `RecipeButton` component. I also added a check to see if there were any recipes in the list. If not, then the panel does not display at all.

The `RecipeButton` component displays the name of the recipe as well as a small panel that appears when hovered over the line. This panel provides the option to edit the recipe, gives a link to the source of the recipe, and gives the option to delete the recipe. While I wrote these as different components, I stored them all in the same file, since there wasn't going to be any reusing of the components.

{% highlight javascript %}
const RecipeButton = (props) => {
  const [hovering, setHovering] = useState(false)
  const classes = useStyles(props)

  const panel = (
    <Paper className={classes.panel}>
      {props.recipe.url ?
        <RecipeSourceButton source={props.recipe.url} />
        : null}
      {props.recipe.name == "Additional Ingredients" ?
        null
        : ( <>
              <RecipeEditButton id={props.recipe.id}/>
              <RecipeDeleteButton id={props.recipe.id} refreshPanels={props.refreshPanels} />
            </>)}
        </Paper>
      )


  return (
    <ListItem
      className={classes.root}
      onMouseEnter={()=>setHovering(true)}
      onMouseLeave={()=>setHovering(false)}>
    {props.recipe.name}
    {hovering ? panel : null}

    </ListItem>
  )
}

const RecipeSourceButton = (props) => {
  return (
    <ButtonBase href={props.source} target="_blank">
      <LinkIcon />
    </ButtonBase>
  )
}

const RecipeEditButton = (props) => {
  return (
    <ButtonBase>
      <Link to={`/recipe/${props.id}`}>
        <EditIcon />
      </Link>
    </ButtonBase>
  )
}

const RecipeDeleteButton = (props) => {
  const {resourceId} = useParams()
  const clickHandler = () => {
    // call the adjusted endpoint for list recipe associations
    axios.get(`/list-recipe-associations`,{
      params: {
        recipe: props.id,
        list: resourceId
      }
    })
    .then(resp=>{
      return axios.delete(`/list-recipe-associations/${resp.data.id}`)
    })
    .then(resp=>props.refreshPanels())
    .catch(err=>console.log(err))
  }
  return (
    <ButtonBase onClick={clickHandler}>
      <RemoveCircleIcon />
    </ButtonBase>
  )
}

export default RecipeButton
{% endhighlight %}

### Modifying the Recipe Side Panel

Next, I created a few modifications to the Recipe Side Panel. Because the new `RecipePanel` component allows for deleting recipes, I decided to forgo that option, only show recipes that weren't added to the list, and turn the whole card into a button.

{% highlight javascript %}
const QuickRecipeAdd = (props) => {
  const user = useSelector(store=>store.user)
  const token = useSelector(store=>store.token)
  const [recipes, setRecipes] = useState([])
  const [associations, setAssociations] = useState([])

  useEffect(()=>{
    getAssociationsAndRecipes()
  }, [props.open])


  const updateList = () => {
    props.getIngredients()
    getAssociationsAndRecipes()
  }

  const getAssociationsAndRecipes = async() => {
    try {
      var assocResponse = await axios.get(`/list-recipe-associations?list=${props.listId}`)
      var recipeResponse = await axios.get(`/recipes?user=${user.id}`)
    } catch (err) {
      console.log(err)
    }

    let assoc = assocResponse.data
    let allRecipes = recipeResponse.data

    const associationSet = new Set(assoc.map(element=>element.recipe_id))

    const filteredRecipes = allRecipes.filter((element)=>{
      if (associationSet.has(element.id)){
        return false
      }
      return true
    })

    setRecipes(filteredRecipes)
    setAssociations(assoc)
  }





  const recipeIsAssociated = (recipe) => {
    for (var i = 0; i < associations.length; i++){
      if (associations[i].recipe_id == recipe.id){
        return associations[i]
      }
    }
    return null

  }

  return (
    <Drawer anchor="left" open={props.open} onClose={props.onClose}>
      <Typography variant="h5" align="center">Your Recipes</Typography>
      <Box m={2}>
        <Divider />
      </Box>
    {recipes.map((recipe, index)=>{
        return (
          <RecipeSideSelector
            key={index}
            recipe={recipe}
            listId = {props.listId}
            updateList={updateList}/>
      )}
    )}
    </Drawer>
  )
}
{% endhighlight %}

Also note here that I've begun experimenting with `async` and `await` commands. I still feel a bit hesitant about them (I'm used to my good old fashioned promise chains), but I do like the increased cleanliness of the syntax and making a full transition to these is something I would consider in the future.

Note also that I used a classic "insert everything into a set and then check if the item is in the set" solution to countless programming problems for determining if any given recipe was already in the list. This was faster than my previous method and significantly more elegant.

# Changes to the Ingredient Panel

Finally, I made some changes to the ingredient panel that hopefully create a much cleaner interface.

For the `IngredientButton`, I removed the old and needlessly complicated system of "superimposing a button on top of text" in favor of simply keeping it a button the whole time, and changing the text when highlighted.

{% highlight javascript %}
const useStyles = makeStyles({
  root: {
    fontFamily: "Acari Sans, Verdana",
    fontSize: "20px",
    color: "white",
    padding: "5px",
    width: "95%",
    margin:"5px auto",
    display:"block",
    borderRadius: "25px",
    "&:hover":{
      backgroundColor: "white",
      color: "black",
    }
  },
  textBox: {
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    overflow: "hidden",
    width: "100%",
    display: "inline-block",
    textAlign: "left"
  }
})

const IngredientButton = (props) =>{
  const [hovering, setHovering] = useState(false)
  const [displayLines, setDisplayLines] = useState(false)
  const classes = useStyles()

  return(
    <>
    <ButtonBase
      className={classes.root}
      onClick={()=>setDisplayLines(prev=>!prev)}>
        <Box
          className={classes.textBox}
          onMouseEnter={()=>setHovering(true)}>
            {props.ingredient}
        </Box>
    </ButtonBase>
    {displayLines ?
      <RecipeLineDisplay
        ingredient={props.ingredient}/>
      : null}
    </>
  )
}
{% endhighlight %}

I also brought in a new component, `RecipeLineDisplay`, that showed the lines that the ingredient came from. This component again had more than one component in its file: one to hold all of the lines, and a separate component to actually make the calls and display each individual line.

{% highlight javascript %}
const RecipeLineDisplayPanel = (props) => {
  const [lines, setLines] = useState([])
  const classes = useStyles(props)
  const {resourceId} = useParams()

  const getLines = () => {
    axios.get(`/lines`,{
      params: {
        list: resourceId,
        ingredient: props.ingredient
      }
    })
    .then(resp=>{
      console.log(resp)
      setLines(resp.data)
    })
  }

  useEffect(()=>{
    getLines()
  },[])

  console.log(lines)

  return (
    <Paper className={classes.root}>
      <List>
      {lines.map((element, index)=>(
        <RecipeLineDisplayLine key={index} line={element} />
      ))}
      </List>
    </Paper>
  )
}

const RecipeLineDisplayLine = (props) => {
  const {line} = props
  const [recipe, setRecipe] = useState({})
  const classes = useStyles()

  const getRecipe = () => {
    axios.get(`/recipes/${line.recipe_id}`)
    .then(resp=>setRecipe(resp.data))
  }

  useEffect(()=>{
    getRecipe()
  },[])

  return(
    <ListItem>
      <span style={{fontStyle:"italic"}}>
        "{line.text.join(' ')}"
      </span>
      <span style={{fontWeight:"bold"}}>
        - {recipe.name}
      </span>
      <ButtonBase className={classes.editButton}>
        <Link to={`/recipe/${line.recipe_id}`}>
          <EditIcon />
        </Link>
      </ButtonBase>
    </ListItem>
  )
}

export default RecipeLineDisplayPanel
{% endhighlight %}

In order to find Recipe Lines this way, I needed to adjust my backend with some new paramaters. You can now search for a recipe line by ingredient or grocery list.

{% highlight python %}
def get_line_by_params(params):
    ingredient = params.get("ingredient")
    grocery_list = params.get("list")
    lines = db.session.query(RecipeLine)

    if ingredient:
        lines = lines.join(LineIngredientAssociations, "ingredients")\
                .join(Ingredient)\
                .filter(Ingredient.name == ingredient)

    if grocery_list:
        lines = lines.join(Recipe)\
                .join(GroceryList, Recipe.grocery_lists)\
                .filter(GroceryList.id == grocery_list)

    return lines.all()

{% endhighlight %}

Each time I work with SQLAlchemy, I understand it a bit better. This is probably my best querying attempt yet, and another thing that I am planning to do "at some point" is go back and rewrite all of my queries to be this modular.

Finally, in the actual `IngredientPanel` component (formerly known as `ListPanel`), I removed the chunking code, displaying all ingredients as a single list instead.

{% highlight javascript %}
return (
  <Paper variant="outlined" className={classes.root}>
    {props.listItems.length > 0 ? (
      props.listItems.map((element, index)=>{
        return <IngredientButton key={index} ingredient={element}/>
      })
    ) : emptyList}

  </Paper>
)
{% endhighlight %}

This just seemed a bit cleaner and more elegant, and to be honest I didn't want to spend a lot of time calibrating the chunk settings to look good on a variety of different screen sizes.

### Conclusions

This is most of what will be on the List Page for the first release of this thing. Honestly, I could keep tweaking and tweaking forever (and that's kind of what I've been doing), but to be honest I'm beginning to get sick of looking at this code. I want to work on something else for a while, so I'd like to release what I've got (with a bit more polish) and turn my attention elsewhere.

Still not quite done here, though. I still need to add some better landing pages and more information about the app for people who aren't signed in. Then I need documentation.

*Sigh*

Well, stay tuned. We're coming up to the end. 
