---
layout: post
title: List Schemas and Changing Queries
author: Steve
---

Well, I'm back again with some more exciting information. This time around, we've got the "GroceryList" schema and endpoints, with a few revisions to how I wrote some of the previous endpoints. Since that deals with information I've already covered, I'll start with it.

### The New Ingredient Query

While attempting to write the logic out for how the GroceryList schema would be read into the backend (more on this later), I quickly ran into an issue that I should have seen coming: the tacked-on "All Ingredients" part of the RecipeSchema was causing the schema to invalidate itself, because "All Ingredients" wasn't actually a proper field. I toyed with this for a little while but ultimately felt that it was better to scrap it entirely; it didn't feel like good programming practice to me to add a sort-of field to the end of a schema and then write a bunch of `pre_load` checks to get rid of it. It's much smoother to have the schema directly reflect the fields of the model; that way the program can automatically handle nested schemas (which I need for the GroceryList).

Of course, that begs the question: if the RecipeSchema doesn't hold all the ingredients that are a part of that Recipe, how will we get them? I did a bit of reading up on API structuring, and ultimately chose to use queries on the "/ingredients" endpoint. The other option would be to add an endpoint to the recipe/lists themselves that returned their ingredients (i.e., "/recipes/5/ingredients"), and while I like the nested loop, I think that grouping the endpoints by what they return is a better idea.

In order to do so, I first modified the basic "GET" route for ingredients to make use of a new function: `get_ingredient_by_params()`, which returned a list of ingredients based on the arguments passed in.

{% highlight python %}
@ingredient.route("/ingredients", methods=['GET'])
def get_ingredients():
    ingredients_to_return = get_ingredient_by_params(request.args)
    return jsonify(ingredients_schema.dump(ingredients_to_return))
{% endhighlight %}

This keeps things nice and simple on the routes page. The actual function is a bit more complex.

{% highlight python %}
# method that checks if there are any arguments to filter, returns all ingredients if not
def get_ingredient_by_params(args):
    if args.get("recipe") and args.get("list"):
        raise InvalidUsage("Error: can't filter by recipe and line at the same time")

    if args.get("recipe"):
        set_to_return = set()
        for recipe_id in args.get("recipe"):
            set_to_return.update(
                Ingredient.query
                .join(RecipeLine, "recipe_lines")
                .join(Recipe)
                .filter(Recipe.id == recipe_id)
                .all())
        return set_to_return

    if args.get("list"):
        set_to_return = set()
        for line_id in args.get("list"):
            set_to_return.update(
                Ingredient.query
                .join(RecipeLine, "recipe_lines")
                .join(Recipe)
                .join(GroceryList, Recipe.grocery_lists)
                .filter(GroceryList.id == line_id)
            )
        return set_to_return

    # no queries, return all ingredients
    return Ingredient.query.all()
{% endhighlight %}

Essentially, this method makes use of several long `join()` statements from sqlalchemy in order to return the ingredients in a given `recipe` or `list`. I used a `set()` in order to eliminate duplicates, but in retrospect I don't think that was necessary; the design of the database should prevent that regardless. I also added a check to see if there was a `list` *and* a `recipe` argument, and to raise an error if so.

This is the format that I'm going to be using for all of my queries. I modified my recipe quaries to use the same logic, and when I add in users (that's for the next post), I'm going to use a similar pattern to query the user's lists.

Now, with that out of the way, let's look at the GroceryList schema and endpoints.

### The Schema

The base schema of the GroceryList is extremely simple, and makes use of `SQLAlchemyAutoSchema` to create it's fields:

{% highlight python %}
# schema that returns/validates a list
class GroceryListSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Recipe
        include_fk = True

    # nested recipes in the list, but we're going to exclude the recipe lines
    recipes = Nested("RecipeSchema", many=True, exclude=("recipe_lines",))
{% endhighlight %}

More complex behavior, however, is needed when it comes to creating a new GroceryList through this schema. I wanted to be able to initialize a GroceryList with Recipes already in it, definied by their "id" attribute, *and* I wanted the option to include ingredents directly into the GroceryList from the beginning. After all, this is fundamentally supposed to represent a list of ingredients; the fact that Ingredients are not directly tied to GroceryLists shouldn't change that.

Let's start with the recipes first. If a list is going to be initalized with recipes, then I just want to be able to pass the `id` of the recipe, and have the backend take care of the rest. This presents a slight problem, though, because the `GroceryListSchema` expects more information than just an id. To solve this, I created a `pre_load` function that takes the provided `id`s and turns them into actual representations of the Recipe:

{% highlight python %}
def add_loaded_recipes(data, recipe_schema):
    print("in add loaded recipes")
    for index, recipe in enumerate(data["recipes"]):
        try:
            full_recipe_schema = recipe_schema.dump(Recipe.query.get(recipe["id"]))
            data["recipes"][index] = full_recipe_schema
        except KeyError:
            raise ValidationError(f"Unable to find recipe: ID not provided. Value: {recipe}")
{% endhighlight %}

This function iterates through all provided recipes, and for each one it returns the full schema of the recipe. If the recipe is not included in the form "{'id': number}", then it throws an error.

I thought this was all I needed, but not quite. I began to get `DataIntegrityError`s when I tried to insert the new list in. Looking through the data made me realize that the `RecipeSchema` was essentailly returning a new recipe object for the `Recipe`s that were already in the database. Consequently, when it tried to insert this new/old recipe, it threw an error.

I solved this by modifying the `RecipeSchema` to sync any validated recipe with it's version in the database (provided one existed). This way, the program didn't try to re-add the recipe.

{% highlight python %}
# create the Recipe object, or return the existing recipe object if it already exists
@post_load
def make_recipe(self, data, ** kwargs):
    try:
        existing_recipe = Recipe.query.get(data["id"])
        if existing_recipe:
            return existing_recipe
    except KeyError:
        # there is no recipe like this in the database yet
        return Recipe(** data)
    return Recipe(** data)
{% endhighlight %}

This got rid of the error. Now, I had to add an ability to add ingredients directly to the RecipeList, without necessiarily having a Recipe act as an intermeditiary. In order to do so, I decided to return to my fix from the previous version: an "Additional Ingredients" Recipe model that is automatically added to every list, and which stores ingredients that the user directly adds to the list.

I initiated this list with another `post_load` function in my GroceryListSchema.

{% highlight python %}
# create the "Additional Ingredients" recipe
@staticmethod
def create_additional_ingredients(data, recipe_schema):
    additional_ingredient_recipe = Recipe(name="Additional Ingredients")
    additional_ingredients = data.pop("ingredients")
    ingredient_schema = IngredientSchema()

    for ingredient in additional_ingredients:
        ingredient = ingredient_schema.load(ingredient)  # load to class

        additional_ingredient_recipe.recipe_lines.append(RecipeLine(text=ingredient.name, ingredients=[ingredient]))

    db.session.add(additional_ingredient_recipe)
    db.session.commit()
    data["recipes"].append(recipe_schema.dump(additional_ingredient_recipe))
{% endhighlight %}

This creates a new recipe called "Additional Ingredients" and iterates through all privided ingredients (which must be provided in a way that the IngredientSchema will understand). For each of the ingredients, it adds a RecipeLine to the Recipe, with the same text as the ingredient. This is essentially what happened in my last version of this app, although this time around, the data is much better organized.

Finally, because I had more than one `post_load` function, I combined them into a single function to make the code easier to read and ensure that they would be run in the proper order.

{% highlight python %}
# function to supply the loaded recipes, rather than creating new ones
@pre_load
def preload_functions(self, data, ** kwargs):
    recipe_schema = RecipeSchema(exclude=("recipe_lines", "_ links"))

    if data.get("recipes"):
        self.add_loaded_recipes(data, recipe_schema)
    else:
        data["recipes"] = []
    self.create_additional_ingredients(data, recipe_schema)

    return data
{% endhighlight %}

Note that this function also checks if there is a "recipes" key in the `data`, and creates one if not. This prevents the `create_additional_ingredients` function from crashing.

With the schema built, it was time to add in my endpoints.

### Endpoints

The "GET" and "POST" request for GroceryList objects are very simple and follow the same format as the other endpoints.

{% highlight python %}
# return list of GroceryLists, with optional filters
@grocerylist.route("/lists", methods=["GET"])
def get_lists():
    # TODO: add checks for filters here

    all_lists = GroceryList.query.all()
    return jsonify(grocerylists_schema.dump(all_lists))


# post a new GroceryList
@grocerylist.route("/lists", methods=["POST"])
def post_list():
    if not request.json.get("grocerylist"):
        raise InvalidUsage("No grocery list found to add.")
    new_list = grocerylist_schema.load(request.json.get("grocerylist"))
    db.session.add(new_list)
    db.session.commit()
    return jsonify(grocerylist_schema.dump(new_list))

# get a specific GroceryList
@grocerylist.route("/lists/<int:id_>", methods=["GET"])
def get_list(id_):
    current_list = GroceryList.query.get(id_)
    if not current_list:
        raise NotFoundException("list", id_, "There is no list with this id.")
    return jsonify(grocerylist_schema.dump(GroceryList.query.get(id_)))
{% endhighlight %}

I have not yet made any direct filters for lists, primarly because I haven't added in the `User` functionality yet, and that will be the main filter. I may also add one for recipes, to return a list of GroceryLists that have a certain Recipe in them.

Otherwise, it's all pretty straightforward. The GroceryListSchema does most of the heavy lifting of creating the object and validiting the code, so all I have to do is pass the json data to it and add the provided list.

Next, I added a "PUT" request to a specific grocery list. This one is slightly more complicated, and relies on a helper function, `add_additional_ingredients`.

{% highlight python %}
# in grocerylistapp.grocerylist.utils.py
def add_additional_ingredients(grocerylist_id, ingredient):
    grocerylist = GroceryList.query.get(grocerylist_id)
    additional_ingredients = Recipe.query\
        .filter(Recipe.name == "Additional Ingredients",
                Recipe.grocery_lists.contains(grocerylist)).first()
    additional_ingredients.recipe_lines.append(RecipeLine(text=ingredient["name"], ingredients=[ingredient_schema.load(ingredient)]))
    db.session.commit()


# add a recipe or an ingredient to a GroceryList
@grocerylist.route("/lists/<int:id_>", methods=["PUT"])
def add_to_list(id_):
    list_to_modify = GroceryList.query.get(id_)

    # add provided recipes
    for recipe in request.json.get("recipes"):
        if recipe.get("id"):
            list_to_modify.recipes.append(Recipe.query.get(recipe.get("id")))
        else:
            raise InvalidUsage("You must add a recipe by its id.")

    # add provided ingredients
    for ingredient in request.json.get("ingredients"):
        if ingredient.get("name"):
            add_additional_ingredients(id_, ingredient)
            pass
        else:
            raise InvalidUsage("You must add an ingredient by its name.")

    return jsonify(grocerylist_schema.dump(list_to_modify))
{% endhighlight %}

This function checks for Recipes and Ingredients, adding them one by one if they exist. Recipes must be added by ID. Ingredients requred the additional function, becuase I needed to load up the "Additional Ingredients" Recipe first, then add the ingredients as RecipeLines. Note that I load the Ingredients using an IngredientSchema. I do this so that it returns the Ingredient from the database (if it exists), or saves the new Ingredient to the database (if it's a new ingredient). This prevents `IntegrityError`s.

Again, Marshmallow has made this so much less complicated; I don't have to worry about creating new Ingredients, because I already wrote that code last week and it doens't need to be rewritten. It's pretty nice.

Finally, I added a "DELETE" endpoint. This was *slightly* more complicated than it first sounds, only becuase I wanted to make sure I deleted the "Additional Ingredients" Recipe along with the GroceryList.

{% highlight python %}
delete a GroceryList
@grocerylist.route("/lists/<int:id_>", methods=["DELETE"])
def delete_list(id_):
   list_to_delete = GroceryList.query.get(id_)
   # get the "Additional Ingredients" list
   additional_ingredients = Recipe.query.filter(Recipe.name == "Additional Ingredients",
                                                Recipe.grocery_lists.contains(list_to_delete)).first()
   db.session.delete(list_to_delete)
   db.session.delete(additional_ingredients)
   db.session.commit()

   return ("", 204)
{% endhighlight %}

### Conclusions

And with that, the GroceryList endpoints and schema are done. I just need to add the `User` schema and endpoints and the bulk of the backend will be done. After that, I still need to add the scraper and integrate spaCy. Then, it's time to start the frontend.
