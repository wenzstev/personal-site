---
layout: post
title: API Endpoints -- Part 1
author: Steve
---

Well, this post has been a little while in the making. I've been hard at work figuring out best practices for my fledgling API, and learning a whole lot more about the process along the way. In the process, I've managed to deepen my understanding of sqlalchemy fairly significantly, improved my error handling, get in an increasingly good place for the future of this app.

### Before we dive in: Error Handling

In the process of making my first few endpoints, I quickly realized that I was going to need a few additional error codes that provided more input than the default flask ones. Checking the documentation, I followed [these](https://flask.palletsprojects.com/en/1.1.x/patterns/apierrors/) recommendations for a quick-and-dirty implementation. My intention here was not to completely flesh out my error handling, but instead to provide something that I could use in the basic creation of my endpoints, so that I could put the errors in *now* and not have to worry about tracking them down later.

I created two errors: the first is essentially a carbon copy of the `InvalidUsage` Exception outlined above, and the second is a more specific `NotFoundException` for 404 errors.

{% highlight python %}
class InvalidUsage(Exception):
    status_code = 400

    def __init__(self, message, status_code=None, payload=None):
        Exception.__init__(self)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.payload = payload

    def to_dict(self):
        rv = dict(self.payload or ())
        rv['message'] = self.message
        return rv


class NotFoundException(InvalidUsage):
    def __init__(self, resource, id, message=None):
        if message is None:
            message = "The resource you've requested does not exist."
        payload = {"details": {"resource": resource, "id": id}}
        super().__init__(message=message, payload=payload, status_code=404)

{% endhighlight %}

As you can see, the `NotFoundException` is a child of `InvalidUsage` and customizes it for 404 responses.

I then created a simple error handler and initialized it as a blueprint.

{% highlight python %}
@errors.app_errorhandler(InvalidUsage)
@errors.app_errorhandler(NotFoundException)
def handle_invalid_usage(error):
    response = jsonify(error.to_dict())
    response.status_code = error.status_code
    return response
{% endhighlight %}

And that's it (for now). Like I said, nothing fancy, just something to use so that I didn't feel like I was leaving huge holes in my endpoints. I plan to come back through later and add some other exceptions, such as an invalid schema.

Anyway, on to the main story.

### Ingredient Schemas and Endpoints

First up is the Ingredient class. I decided to use [marshmallow](https://marshmallow.readthedocs.io/en/stable/) (specifically, the [flask-marshmallow](https://flask-marshmallow.readthedocs.io/en/latest/) and [marshmallow-sqlalchemy](https://marshmallow-sqlalchemy.readthedocs.io/en/latest/) integrations) for my serializing and validating. I liked the idea of holding all of my validating, loading, and dumping into a series of classes, and after writing the code for a few of my endpoints, I'm confident I made the right decision.

The integration with flask-sqlalchemy makes serilization very easy; I just have to declare the schema as a child of `SQLAlchemyAutoSchema` and marshmallow does most of the heavy lifting for me.

{% highlight python %}
# schema that returns/validates an ingredient
class IngredientSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Ingredient
        include_fk = True

    # links to the ingredient, via name and id
    _ links = ma.Hyperlinks(
        {"by name": ma.URLFor("ingredient.get_ingredient", identifier="<name>"),
         "by id": ma.URLFor("ingredient.get_ingredient", identifier="<id>")}
    )

    # return an ingredient when schema is loaded
    @post_load
    def make_ingredient(self, data, ** kwargs):
        return Ingredient(** data)
{% endhighlight %}

The two other piece of code here to note are the `_links` field, which links to my endpoints for the ingredient (more on that in a moment), and the `@post_load` function, which returns the actual object rather than a dictionary of attributes.

With the schema defined, I created my endpoints. The first is the simplest; a `"/ingredients"` `GET` call will return a list of all ingredients in the database.

{% highlight python %}

@ingredient.route("/ingredients", methods=['GET'])
def get_ingredients():
    all_ingredients = Ingredient.query.all()
    return jsonify(ingredients_schema.dump(all_ingredients))

{% endhighlight %}

Likewise, a `POST` call to the same route inserts a new ingredient. Here I added a try/except block to catch several of the most common errors that might happen (errors that I'd tried to plan for in my creation of the database). An `IntegrityError` means that the ingredient is already in the database, while a `ValueError` means that the ingredient does not conform to database standards (just letters and spaces).

{% highlight python %}

@ingredient.route("/ingredients", methods=['POST'])
def add_ingredients():
    try:
        new_ingredient = ingredient_schema.load(request.json.get("ingredient"))
        db.session.add(new_ingredient)
        db.session.commit()
        return jsonify(ingredient_schema.dump(new_ingredient)), 201
    except IntegrityError:
        raise InvalidUsage("The ingredient you tried to submit is already in the database",
                           payload=request.json.get("ingredient"))
    except ValueError as error:
        raise InvalidUsage("The ingredient you tried to submit does not conform to database standards.",
                           payload={"details": {"resource": request.json.get("ingredient"), "comments": str(error)}})

{% endhighlight %}

Finally, I added specific `GET` and `DELETE` calls. Here I did something a bit differently; I wanted people to be able to identify the ingredient either by name or by id (though I figure that identifying by name will be more common). To achieve this, I created two decorators for each route with a common variable name `identifier`, and wrote a simple function that returns an ingredient for the `id` or the `name`. This prevented a lot of double code.

*(Note also that I replace the "-" sumbols with spaces; that way "whole milk" can be written as either "whole-milk" or the automatic encoding "whole%20milk.")*

{% highlight python %}
# method that can take either a name or an id and return an ingredient
def ingredient_by_name_or_id(identifier):
    if type(identifier) == str:
        return Ingredient.query.filter_by(name=identifier.replace("-", " ")).first()
    if type(identifier) == int:
        return Ingredient.query.get(identifier)


@ingredient.route("/ingredients/<int:identifier>", methods=["GET"])
@ingredient.route("/ingredients/<string:identifier>", methods=["GET"])
def get_ingredient(identifier):
    cur_ingredient = ingredient_by_name_or_id(identifier)

    if not cur_ingredient:
        raise NotFoundException("ingredient", identifier)

    return jsonify(ingredient_schema.dump(cur_ingredient))


@ingredient.route("/ingredients/<string:identifier>", methods=["DELETE"])
@ingredient.route("/ingredients/<int:identifier>", methods=["DELETE"])
def delete_ingredients(identifier):
    ingredient_to_delete = ingredient_by_name_or_id(identifier)
    if not ingredient_to_delete:
        raise InvalidUsage("The ingredient you're trying to delete does not exist", 404)

    db.session.delete(ingredient_to_delete)
    db.session.commit()

    return ('', 204)

{% endhighlight %}

... and those are my ingredient endpoints! Definitely the simplest among them, as each ingredient is just a single atomic value that can't be changed. They can be added and deleted (although I'm going to restrict who can delete them), but otherwise they're kind of inert.

### RecipeLine Schemas and Endpoints

Next I built endpoints for the RecipeLine objects. This might not seem strictly necessary at first glance, but remember that I need to add ways for individual ingredients to be added to and taken away from recipe lines, so it was necessary to have a way to get to an individual line.

First I created a new schema for the RecipeLine object. This schema has a `Nested` field that returns the schemas for the ingredients that make up the line.

{% highlight python %}
# schema that returns/validates a recipeLine
class RecipeLineSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = RecipeLine
        include_fk = True

    # nested schema for the ingredients on the line
    ingredients = Nested(IngredientSchema, many=True, exclude=("_links",))

    # link to individual line
    _links = ma.Hyperlinks({
        "line": ma.URLFor("line.get_line", id_="<id>")
    })

    # return a recipeline when schema is loaded
    @post_load
    def make_recipe(self, data, ** kwargs):
        return RecipeLine(** data)
{% endhighlight %}

My `GET` and `DELETE` calls are essentially the same as with my ingredients: they identify a line by its `id` attribute and return/delete it as necessary. Currently, I'm using the "/lines" route. I toyed with the idea of nesting routes with recipes (i.e., "/recipe/recipe-id/lines/line-id"), but at the moment the identity of the recipe a line is part of isn't needed to get the line, and I wanted to avoid unnecessary routes.

{% highlight python %}
@line.route("/lines/<int:id_>", methods=['GET'])
def get_line(id_):
    current_line = RecipeLine.query.get(id_)
    if not current_line:
        raise NotFoundException("line", id_)
    return jsonify(recipeline_schema.dump(current_line))


@line.route("/lines/<int:id_>", methods=["DELETE"])
def delete_line(id_):
    line_to_delete = RecipeLine.query.get(id_)
    if not line_to_delete:
        raise NotFoundException("line", id_)

    db.session.delete(line_to_delete)
    db.session.commit()

    return ('', 204)
{% endhighlight %}

My next endpoint, however, is a bit different. It's a `PUT` call to an individual line, and is used to set the ingredients on the line. In creating this method, I knew that I wanted several features. I wanted to be able to input a list of ingredients, and I wanted the program to automatically add any of the ingredients in the list to the database if they were not already there. It would then link the ingredients to the line, raising the database's validator error if the ingredient in question was not on the line.

In order to do this, I created a new schema, `RecipeLineUpdateSchema`, that checks the `PUT` data and validates it as ingredients. If so, it "cleans" the ingredient by making it all lower case and removing dashes, and checks the database to see if the ingredients are there. If not, it adds them. Finally, it returns a list of all the ingredients, ready to be added to the recipe line.

{% highlight python %}
# schema for updating a recipe line with new ingredients
class RecipeLineUpdateSchema(ma.Schema):
    ingredient = fields.Str(requred=True)

    # check if the found ingredients exist, and create them if not
    @post_load
    def check_if_ingredients(self, data, ** kwargs):
        # clean the ingredient
        data["ingredient"] = data["ingredient"].lower()
        data["ingredient"] = data["ingredient"].replace("-", " ")

        # check if it's in the database
        if not Ingredient.query.filter_by(name=data["ingredient"]).first():
            new_ingredient = Ingredient(name=data["ingredient"])
            db.session.add(new_ingredient)
            db.session.commit()
            return new_ingredient
        else:
            return Ingredient.query.filter_by(name=data["ingredient"]).first()
{% endhighlight %}

This schema is then used to validate the input in my actual route:

{% highlight python %}
@line.route("/lines/<int:id_>", methods=['PUT'])
def set_line_ingredients(id_):
    current_line = RecipeLine.query.get(id_)
    if not current_line:
        raise NotFoundException("line", id_)

    print(request.json.get("ingredients"))

    # load ingredients, validating them and creating new Ingredient classes if necessary
    new_ingredients = recipelines_update_schema.load(request.json.get("ingredients"))
    print(new_ingredients)

    try:
        current_line.ingredients.extend(new_ingredients)
        db.session.commit()
    except IntegrityError:
        return jsonify({"error": "One or more of the ingredients is not in the line"})

    return jsonify(recipeline_schema.dump(current_line))
{% endhighlight %}

What I like about this approach is how it simplifies my routes. Because most of the logic is done in other classes, my endpoints end up looking much cleaner. I may push this further in the future, however, and abstract them away to a series of nice looking functions.

### Recipe Schema and Endpoints

Finally, we come to the third schema/endpoint grouping that I have created. The recipe schema is essentially the same as the two previous schemas (including a `Nested` field for the RecipeLine objects). There is one critical difference, however: I wanted to be able to easily access all the ingredients in *all* the lines of the recipe--essentially have a list of all the ingredients needed to make the recipe. But the Recipe objects don't actually know all their ingredients--the lines do. This meant I would need some `join` statements for my database.

Honestly, it took me longer than I care to admit to get this one working, but I persisted and I feel like I have a much better grasp on SQLAlchemy now. With my last attempt, dealing with the database was more or less like a black box; I could ask for simple things and otherwise tried to leave it alone. This time around, I have a much better concept of how it actually works.

{% highlight python %}
ingredients_in_recipe = Ingredient.query.\
    join(RecipeLine, Ingredient.recipe_lines).\
    join(Recipe).filter(Recipe.id == data["id"]).\
    all()
{% endhighlight %}

I query the Ingredient class and create a join with the RecipeLine class, based on the RecipeLines that are associate with an ingredient (this eliminates ingredients that are not in any RecipeLine). Then I join that with the Recipe table; I don't need to specify the join here because SQLAlchemy automatically defaults to a many-to-one relaitonship. This would, I believe, eliminate any Recipe without lines, although that isn't really a situation I expect will be encounted.

*Then*, this query is filtered by the id of the current recipe (that's the `data["id"]` call), resulting in only ingredients that are in the given recipe. The final `.all()` just returns them as a list.

Here's the call in the entire schema:

*(NOTE: Some of this information is no longer current. Please see [this]{% post_url 2020-05-09-Schemas-Part-2 %} for an updated look at how I'm filtering ingredients.)*

{% highlight python %}
# schema that returns/validates a recipe
class RecipeSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Recipe
        include_fk = True

    # nested Schema for recipe lines
    recipe_lines = Nested("RecipeLineSchema", many=True, exclude=("recipe_id",))

    # provide links to the resource
    _links = ma.Hyperlinks(
        {"individual": ma.URLFor("recipe.get_recipe_info", id_="<id>"),
         "collection": ma.URLFor("recipe.get_recipes")}
    )

    # gather all ingredients in recipe together
    @post_dump
    def consolidate_ingredients(self, data, ** kwargs):
        ingredients_in_recipe = Ingredient.query.\
            join(RecipeLine, Ingredient.recipe_lines).\
            join(Recipe).filter(Recipe.id == data["id"]).\
            all()
        ingredients_schema = IngredientSchema(many=True)

        data["all_ingredients"] = ingredients_schema.dump(ingredients_in_recipe)
        return data

    # create the Recipe object
    @post_load
    def make_recipe(self, data, ** kwargs):
        return Recipe(** data)
{% endhighlight %}

Next, I created some endpoints for the recipe, including a `GET` for all recipes and for an individual recipe, and a `POST` to add an additional recipe.

{% highlight python %}
@recipe.route("/recipes", methods=["GET"])
def get_recipes():
    all_recipes = Recipe.query.all()
    return jsonify(recipes_schema.dump(all_recipes))


@recipe.route("/recipes", methods=["POST"])
def post_recipe():
    new_recipe = recipe_schema.load(request.json.get("recipe"))
    db.session.add(new_recipe)

    db.session.commit()
    return jsonify(recipe_schema.dump(new_recipe)), 201


@recipe.route("/recipes/<int:id_>", methods=["GET"])
def get_recipe_info(id_):
    current_recipe = Recipe.query.get(id_)
    if not current_recipe:
        raise NotFoundException("recipe", id_)

    return jsonify(recipe_schema.dump(current_recipe))


@recipe.route("/recipes/<int:id_>", methods=["DELETE"])
def delete_recipe(id_):
    recipe_to_delete = Recipe.query.get(id_)
    if not recipe_to_delete:
        raise NotFoundException("recipe", id_, "The recipe you are trying to delete does not exist.")

    db.session.delete(recipe_to_delete)
    db.session.commit()

    return ('', 204)

{% endhighlight %}

Another great thing about using Marshmallow is that the nested schemas allow me to create Recipes, RecipeLines, and Ingredients all in one, if I want. For example, a valid `POST` to create a new recipe, lines, and ingredients could look like:

{% highlight javascript %}
{
	"recipe": {
		"name": "Chicken n' Eggs",
		"url": "www.test.com",
		"recipe_lines": [
			{"text": "one pound chicken breasts",
				"ingredients": [{"name": "chicken breasts"}]
			},
			{"text": "2 tablespoons flour",
				"ingredients": [{"name": "flour"}]
			},
			{"text": "3 large eggs",
				"ingredients":[{"name": "eggs"}]
			}
		]
	}
}
{% endhighlight %}

This is the format that I hope to initalize new recipes with on the frontend, but I'm getting ahead of myself. Plus, there are still some bugs to work out in this area.

### Filtering Recipes by Ingredient

One last area to note here before I close out this post. There will be times when I user might want to search for a recipe based on the ingredients in it. Maybe they have some extra eggs or something and want to know what to do with them. Because of this, and because I would need how to add filters anyway, I created a query for the main recipe route that filters by ingredients. Ingredients would be requested in the format "/recipes?ingredients=eggs,bacon,whatever-you-want" and the route would return a list of all recipes in the database with these ingredients. This necessitated another lengthy join statement, but this one didn't take as long; I think I'm getting the hang of it.

More difficult was filtering by all of the different ingredients. At first, the base `in_` SQLAlchemy command functioned as an "OR" statement, returning every recipe that had, say, eggs OR bacon, which is cool but not what I wanted for this command (maybe later though). Ultimately, I used `set`s, creating a simple `__hash__` in the Recipe model class, building a set for each requested ingredient, and then finding the intersection of all the sets.

{% highlight python %}
filter_by_ingredients = request.args.get("ingredient")  # ingredient filter
    if filter_by_ingredients:
        # create a list, then iterate through the list and return a set of recipes that contain that ingredient
        recipes_by_ingredient = []
        for ingredient in filter_by_ingredients.split(','):
            recipes_by_ingredient.append(
                set(Recipe.query.join(RecipeLine).
                    join(Ingredient, RecipeLine.ingredients).
                    filter(Ingredient.name == ingredient).all()))
        # find the intersection of all the sets and return
        intersection_set = set(recipes_by_ingredient[0]).intersection(* (recipes_by_ingredient[1:]))
        return jsonify(recipes_schema.dump(intersection_set))
{% endhighlight %}

Currently, this code is in the main route of the "/recipes" `GET` method, but I plan to change that. Right now, I'm just glad it works.

### Conclusions

This has been a very long post, and, especially towards the end of this work, I felt that I was maybe not structuring as well as I could be, and there are certainly areas to go back to and build on. But still, I'm quite pleased with what I've accomplished here. I've made great progress on the endpoints and vastly expanded my knowlege of how APIs work. Plus, I think I'm writing much better code. I'll have to post some to Reddit soon to rid myself of that notion.

Until next time, signing off.
