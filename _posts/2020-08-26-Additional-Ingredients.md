---
layout: post
title: New Functions for the List Page
author: Steve
---

Well, this post has taken a bit longer than I would have liked, but I've been pretty busy so hopefully that'll make up for it.

It was time for the list page to get a bit more love. The [last time I worked on it]({% post_url 2020-07-16-Grocery-App-Frontend-1 %}) was at the very beginning of this project, and it was little more than a quick sweep over to get the layout down. Well, I'm going to be doing some changes to the layout in the future (stay tuned for that blog post), but in the mean time I wanted to add some new functions: namely, the ability to add and remove recipes from the list, and the ability to add additional ingredients.

Both of these proved more complicated than I expected.

### The Quick Recipe Bar

I wanted a way for a user to quickly add and remove recipes from their grocery list without having to toggle back to the main page and do it there (not that they can currently do it there either... man, there's still a lot to do on this project). My idea was to have a sidebar that would list all of the user's recipes, with a single button to choose if they wanted the recipe in or out of the list. This toolbar would have to load the recipes itself, check if they were in the list, and then conditionally render a button to add or remove them. The list would then need to be refreshed.

After some work, here's what I came up with. Each recipe is stored on a `RecipeSideSelector` component, which is basically a card with some styling.

{% highlight JavaScript %}
return(
  <Box mb={2} mx={1}>
    <Card variant="outlined">
      <Typography variant="h6">
        {recipe.name}
      </Typography>
      <List>
        {ingredientsToDisplay.map((ingredient, index)=><ListItem key={index}>{ingredient.name}</ListItem>)}
      </List>
      {inList ?
        <Button onClick={removeRecipeFromList}>Remove</Button>
      : <Button onClick={addRecipeToList}>Add</Button>}
    </Card>
  </Box>
)
{% endhighlight %}

It has functions to both add and remove a recipe from a list, depending on the recipe's current state. It does so by making the necessary funciton calls (notice I have switched to using [axios](https://www.npmjs.com/package/axios), an ongoing process).

{% highlight javascript %}
const addRecipeToList = () => {
  axios.post('/list-recipe-associations', {
    'grocerylist_id': listId,
    'recipe_id': recipe.id
  })
  .then(()=>updateList())
}

const removeRecipeFromList = () => {
  axios.delete('/list-recipe-associations/${inList.id}')
  .then(()=>updateList())
}
{% endhighlight %}

The appearance and presence of these cards is governed by the `QuickRecipeAdd` component, which gathers the recipes and determines if they are a part of the list or not. It's `render` method makes use of the `Drawer` component from Material UI, like so:

{% highlight javascript %}
return (
  <Drawer anchor="left" open={props.open} onClose={props.onClose}>
    {recipes.map((recipe, index)=>{
      const assoc = recipeIsAssociated(recipe)
      return (
        <RecipeSideSelector
          key={index}
          recipe={recipe}
          listId = {props.listId}
          inList={recipeIsAssociated(recipe)}
          updateList={updateList}/>
    )}
  )}
  </Drawer>
)
{% endhighlight %}

Whenever the drawer is opened, a `useEffect` hook calls the recipes and the associations:

{% highlight javascript %}
const [recipes, setRecipes] = useState([])
const [associations, setAssociations] = useState([])


const getRecipes = () => {
  axios.get(`/recipes?user=${user.id}`)
  .then(res=>setRecipes(res.data))
}

const getAssociations = () => {
  axios.get(`/list-recipe-associations?list=${props.listId}`)
  .then(res=>setAssociations(res.data))
}

useEffect(()=>{
  getRecipes()
  getAssociations()
}, [props.open])
{% endhighlight %}

The (still buggy) `recipeIsAssociated` method determines if an association is in the recipe or not, depending on the provided `associations` state.

{% highlight javascript %}
const recipeIsAssociated = (recipe) => {
  for (var i = 0; i < associations.length; i++){
    if (associations[i].recipe_id == recipe.id){
      return associations[i]
    }
    return null
  }
}
{% endhighlight %}

Finally, there's a small method (passed down to the `RecipeSideSelector` component) that essentially refreshes the list of ingredients whenever a recipe is added or removed.

{% highlight javascript %}
const updateList = () => {
  props.getIngredients()
  getAssociations()
}
{% endhighlight %}

And that pretty much sums up the quick recipe toolbar. As I mentioned above, there are some bugs that still need fixing, but my next cycle is a bunch of polishing and bug fixing, so I'll take care of those things then.

### Additional Ingredients

This one was significantly harder, and required some modifying of the backend before I could get it to work.

First, I created a few new components, all variants of a single `AddIngredient` component. There was the parent component and then two children, one for when the component was "open" and one for when it was "closed."

{% highlight javascript %}
const AddIngredientButton = (props) => {
  const [inputOpen, setInputOpen] = useState(false)
  const [newIngredient, setNewIngredient] = useState("")


  return (
    <div>
      {inputOpen ?
        <OpenAddIngredient
          newIngredient={newIngredient}
          setInputOpen={setInputOpen}
          setNewIngredient={setNewIngredient}
          getIngredients={props.getIngredients} />
        : <ClosedAddIngredient
          setInputOpen={setInputOpen}/>}
    </div>
  )
}
{% endhighlight %}

The `ClosedAddIngredient` is the simpler of the two: it's just a button with a "plus" on it that, when clicked, opens the `OpenAddIngredient` component.

{% highlight javascript %}
const ClosedAddIngredient = (props) => {

  return (
    <ButtonBase onClick={()=>props.setInputOpen(true)}>
      <AddCircleIcon />
    </ButtonBase>
  )
}
{% endhighlight %}

The `OpenAddIngredient` component is a bit more complex, and a bit of it won't make sense until I explain the backend changes, so keep that in mind. It first calls the new route "/lists/[listId]/additionalingredinets" to retrieve the new, dedicated "Additional Ingredients" recipe. Then, it defines a function that will add an ingredient to that recipe, saving most of the formatting work for the backend.

{% highlight javascript %}
const OpenAddIngredient = (props) => {
  const [additionalIngredients, setAdditionalIngredients] = useState()
  const {listId} = useParams()

  useEffect(()=>{
    axios.get(`/lists/${listId}/additionalingredients`)
    .then(resp=>{
      setAdditionalIngredients(resp.data)
    })
  },[])

  const addAdditionalIngredient = (ing) => {
    axios.post(`/lines`,{
      text: ing,
      recipe_id: additionalIngredients['id'],
      additional_ingredient: true
    })
    .then(()=>{props.getIngredients()})
    .catch(err=>console.log(err))
  }
{% endhighlight %}

The actual component returns a `Box`, an `Input`, and two buttons, one to submit the ingredient and one to close the component.

{% highlight javascript %}
return (
  <Box component="span">
    <Input value={props.newIngredient} onChange={(e)=>props.setNewIngredient(e.target.value)}/>
    <ButtonBase onClick={()=>addAdditionalIngredient(props.newIngredient)}><CheckCircleIcon /></ButtonBase>
    <ButtonBase onClick={()=>props.setInputOpen(false)}><RemoveCircleIcon /></ButtonBase>
  </Box>
)
{% endhighlight %}

On the backend side of things, I first made a few more modifications to my underlying model, adding a new, dedicated `Recipe` for storing additional ingredients to every list.

{% highlight python %}
class GroceryList(db.Model):
    __tablename__ = 'grocery_list'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    recipes = db.relationship("Recipe",
                              secondary=recipe_list_associations,
                              back_populates="grocery_lists")
    additional_ingredients_id = db.Column(db.Integer, db.ForeignKey("recipe.id"))
    creator_id = db.Column(db.Integer, db.ForeignKey("user.id"))   # the creator of the grocerylist. can add others to edit
    creator = db.relationship("User", back_populates="created_lists")
    editors = db.relationship("User",                           # other users with permission to edit the grocery list
                            secondary=user_list_associations,
                            back_populates="editable_lists")
    additional_ingredients = db.relationship("Recipe", back_populates="ai_list", cascade="all, delete-orphan", single_parent=True)

    def create_additional_ingredients_recipe(self):
        additional_ingredients_recipe = Recipe(name="Additional Ingredients", creator_id=self.creator_id)
        self.additional_ingredients = additional_ingredients_recipe
        self.recipes.append(additional_ingredients_recipe)
        db.session.add(additional_ingredients_recipe)
        db.session.commit()
{% endhighlight %}

The `create_additional_ingredients` function is called during the creation of every new list:

{% highlight python %}
# post a new GroceryList
@grocerylist.route("/lists", methods=["POST"])
@auth.login_required
def post_list():
    new_list_json = request.json
    new_list_json["creator_id"] = g.user.id
    new_grocerylist = post_new_resource(GroceryList, new_list_json)
    new_grocerylist.create_additional_ingredients_recipe()
    return jsonify(grocerylist_schema.dump(new_grocerylist)), 201

{% endhighlight %}

I also added a new route for accessing this list:

{% highlight python %}
# special route for accessing the "Additional Ingredients" recipe for a specific list
@grocerylist.route("/lists/<int:id_>/additionalingredients", methods=['GET'])
def get_additional_ingredients(id_):
    list_to_get = get_resource_or_404(GroceryList, id_)
    recipe_schema = RecipeSchema()
    return jsonify(recipe_schema.dump(list_to_get.additional_ingredients))
{% endhighlight %}

I then made some changes to the `RecipeLine` schema, such that it would check for the tag "additional_ingredients". If it found it, it would run the line through the spaCy parser for an accurate token split, and then set the entire line as the ingredient.

{% highlight python %}
@pre_load
 def convert_line_from_text(self, data, **kwargs):
     if data.get("convert_from_text"):
         converted_data = determine_ingredients_in_line(data["text"])
         converted_data["recipe_id"] = data["recipe_id"]
         return converted_data
     if data.get("additional_ingredient"):
         converted_data = determine_ingredients_in_line(data["text"])
         converted_data["recipe_id"] = data["recipe_id"]
         end_token = len(json.loads(converted_data["text"]))     # have to load because it was packed in string form
         overwrite_ingredients = {"ingredient": {"name": data["text"]}, "relevant_tokens": [0, end_token]}
         converted_data["ingredients"] = [overwrite_ingredients]
         print("converted data", converted_data)
         return converted_data
     return data
{% endhighlight %}

This is a workaround, and it comes from the fact that there isn't really an easy way to directly associate an ingredient with a list. The creation of a middle-man recipe is the best way I can think of doing this without drastic changes to the underlying model structure. And I think it has some advantages, too; it eliminates the possibility of duplicate ingredients, since anything the user adds that's already in the list won't be added a second time. It took a bit of time to make this work though; some of my earlier modifications to make the recipe page work got in the way. I think that's a sign that things are starting to get complex and I need to take a step back and do some refactoring. I've decided to release my first version soon, with a limited amount of features, just to have something out in the world while I continue to work (and continue to look for a job). So I expect my next few posts will involve polishing features and fixing bugs, as well as some under-the-hood refactoring work. Stay tuned.
