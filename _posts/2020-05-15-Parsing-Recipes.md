---
layout: post
title: Parsing Recipes and Refactoring
author: Steve
---

I've been working on a bit of a hodgepodge of features as I near completion of the backend. After implementing the endpoints for the users, all that was left to do for full (albeit still buggy) functionality was to implement the ability to parse recipe lines, and add spaCy back into the equation.

The recipe parser was actually quite easy: I pretty much just used the code I'd made for the first version of this app and did some rewriting to make sure it functioned properly in it's new setting. I also added some tweaks to catch more of the AllRecipes recipes, since before I was having some issues.

There's too much code to post all of it here, but to recap: I have two dictionaries that store information related to scraping. The first is for simple cases, where the recipe lines and the title are just in simple containter tags (such as `<div>` or `<h1>`). For these, I store the specifics of the required tags, and and pull them out when necessary. The dictionary keys are matched to the website name:

{% highlight python %}
# dictionary that stores the specifications for scraping various websites
ingredient_parsers = {
    "www.foodnetwork.com": {
        "title": ("span", "class", "o-AssetTitle__a-HeadlineText"),
        "lines": ("p", "class", "o-Ingredients__a-Ingredient")
    },
    "www.food.com": {
        "title": ("div", "class", "recipe-title"),
        "lines": ("div", "class", "recipe-ingredients__ingredient")
    },
    "www.yummly.com": {
        "title": ("h1", "class", "recipe-title"),
        "lines": ("li", "class", "IngredientLine")
    },
    ...
  }

  o = urlparse(url)

# from the main function
print('url is from ', o.netloc)

parsing_information = ingredient_parsers.get(o.netloc, "")

if parsing_information:
    component, attribute, name = parsing_information["title"]
{% endhighlight %}

Some websites require more complicated ways to access the data, either because the recipe lines don't have an associated attribute or becuase there is more than one way the pages are laid out. For these, I have a second dictionary that stores functions on how to get the recipe from that specific website. For example, here's the function for allrecipes.com:

{% highlight python %}
def get_recipe_allrecipes(soup):
    ingredient_classes = soup.find_all("span", class_="recipe-ingred_txt")
    if not ingredient_classes: # more than one way that recipes are stored
        ingredient_classes = soup.find_all("span", class_="ingredients-item-name")
        print(ingredient_classes)

    ingredient_lines = [line.get_text().strip() for line in ingredient_classes]
    print(ingredient_lines)

    recipe_title = soup.find("h1", {"id": "recipe-main-content"})
    if not recipe_title:
        recipe_title = soup.find("h1", {"class": "heading-content"})
    if not recipe_title:
        recipe_title = soup.title()

    try:
        title_text = recipe_title.getText()
    except AttributeError:
        title_text = recipe_title


    print(recipe_title)

    return {
        'title': title_text,
        'recipe_lines': ingredient_lines
    }
{% endhighlight %}

Then all I have to do is return the result of the evaluated function:

{% highlight python %}
elif o.netloc in ingredient_functions:
    ingredient_information = ingredient_functions[o.netloc](soup)
    recipe_title = ingredient_information["title"]
    ingredient_lines = ingredient_information["recipe_lines"]

{% endhighlight %}

Either way, I return a dictionary with the name of the recipe, the lines in the recipe, and the url I got it from.

{% highlight python %}
return {
        "name": recipe_title,
        "url": url,
        "recipe_lines": ingredient_lines
    }
{% endhighlight %}

This produces a format that works for my schema. Accordingly, I felt that the best place to insert this functionality into the main program was in the `pre_load` of the `RecipeSchema`. That way, the user could pass in a url and get the complete recipe without me having to write a bunch of special cases.

But before that, I wanted to implement spaCy functionality. After all, loading a recipe into the program doesn't do much when the program can't tell what the ingredients are.

I created a new `nlp` object in my `__init__.py` file, and wrote a simple function that takes a provided recipe dictionary and determines the ingredients in the line. It also formats the ingredients properly, so that the `IngredientSchema` can recognize them. This way, new ingredients that aren't in the database are automatically added.

{% highlight python %}
def determine_ingredients_in_line(recipe_dict):
    print("determining ingredients")

    recipe_lines_with_ingredients = []

    for line in recipe_dict["recipe_lines"]:
        current_recipe_line = {
            "text": line,
            "ingredients": []
        }
        print(line)
        line_nlp = nlp(line)

        for ent in line_nlp.ents:
            if (ent.label_ == "INGREDIENT"):
                current_recipe_line["ingredients"].append({"name": ent.text})
        recipe_lines_with_ingredients.append(current_recipe_line)

    recipe_with_ingredients = recipe_dict
    recipe_with_ingredients["recipe_lines"] = recipe_lines_with_ingredients

    return recipe_with_ingredients
{% endhighlight %}

This was honestly much easier than last time, because spaCy has a built-in way to determine the size of various tokens. Previously, I had to split the tokens up just to recombine them again later. It's just another example of how rough my first version was. So much unnecessary work.

But anyway, I put both the scraper and the parser into the `pre_load` section of the `RecipeSchema`, and had it check for a specific tag, `create_from_url`, in order to determine if the recipe needed to be created this way. If not, it simply passed on the provided data.

{% highlight python %}
@pre_load
def build_from_url(self, data, ** kwargs):
    if data.get("create_from_url", ""):
        try:
            recipe_from_url = get_recipe_from_url(data["create_from_url"])
            recipe_from_url_with_ingredients = determine_ingredients_in_line(recipe_from_url)
            recipe_from_url_with_ingredients["creator_id"] = data["creator_id"]
            return recipe_from_url_with_ingredients
        except KeyError as e:
            raise ValidationError(f"Missing data: {repr(e)}")
    return data
{% endhighlight %}

And with that, all of the basic functionality for my backend is done! It's still a bit of a mess though, and so I next turned my attention to refactoring.

I want to follow the "DRY" principle as best I can, and looking through my endpoints, I noticed that there was a lot of repeated code. Plus, the endpoint logic in my various `routes` files was complicated and hard to follow. I decided that I was going to kill two birds with one stone here, and move all of the logic for my endpoints into centralized functions that could be repeated for all resources. After all, the same basic functions work for every resource, right?

I started with the simplest version of this I could: the humble `GET` request. It's fairly short, as far as the endpoint functions go, but it still exposes a lot of unnecessary logic.

{% highlight python %}
@recipe.route("/recipes/<int:id_>", methods=["GET"])
def get_recipe_info(id_):
    current_recipe = Recipe.query.get(id_)
    if not current_recipe:
        raise NotFoundException("recipe", id_)

    return jsonify(recipe_schema.dump(current_recipe))
{% endhighlight %}

In order to generalize the code, I first created a new `utils.py` file for the whole application (though I might rename it to something more apt). I then wrote a function that takes in the model type and the identifier (either the `id_` or the `name` in the case of an ingredient) and either returns the resource or raises an error if it couldn't be found.

{% highlight python %}
def get_resource_or_404(resource_type, identifier):
    if type(identifier) == str:     # only used for ingredients
        resource = resource_type.query.filter_by(name=identifier).first()
    else:
        resource = resource_type.query.get(identifier)
        print(resource, identifier)
    if not resource:
        raise NotFoundException(resource_type, identifier)
    return resource
{% endhighlight %}

From there, my `Recipe` "GET" endpoint became just:

{% highlight python %}
@recipe.route("/recipes/<int:id_>", methods=["GET"])
def get_recipe_info(id_):
    current_recipe = get_resource_or_404(Recipe, id_)
    return jsonify(recipe_schema.dump(current_recipe))
{% endhighlight %}

Absolutely beautiful. At this point, I was inspired. I turned my attention to a slightly more challenging problem: the "POST" request.

For reference, here's my `GroceryList` "POST" request before refactoring:

{% highlight python %}
@grocerylist.route("/lists", methods=["POST"])
def post_list():
    if not request.json.get("grocerylist"):
        raise InvalidUsage("No grocery list found to add.")
    new_list = grocerylist_schema.load(request.json.get("grocerylist"))
    db.session.add(new_list)
    db.session.commit()
    return jsonify(grocerylist_schema.dump(new_list))
{% endhighlight %}

Again, it's not *terrible* but there's still too much low level logic exposed for my taste. I want the endpoint files to operate almost as a table of contents to direct a reader to other areas of of the program, where the actual logic takes place.

But a "POST" request was a bit trickier. After all, different things need to be validated for different resources. But my use of schemas makes this easy; by putting the validation logic there, instead of in the endpoint functions, I can generalize it with a simple dictionary.

{% highlight python %}
schemas_to_models = {
    "ingredient": ingredient_schema,
    "recipe_line": recipeline_schema,
    "recipe": recipe_schema,
    "grocery_list": grocerylist_schema,
    "user": user_schema
}
{% endhighlight python %}

From there, I split the actual POST function into two functions. The first loads and validates the new resource, and the second commits it to the database.

{% highlight python %}
def load_resource_from_schema(resource_type, request_json):
    new_resource_json = request_json.get(resource_type.__tablename__)
    if not new_resource_json:
        raise InvalidUsage(f"Data formatted incorrectly, no label of {resource_type.__tablename__} provided.")

    try:
        new_resource = schemas_to_models[resource_type.__tablename__].load(new_resource_json)
        return new_resource
    except ValidationError as e:
        raise InvalidUsage("Your data was not formatted correctly.", payload=e.messages)
    except IntegrityError:
        raise InvalidUsage("Your data was not formatted correctly; you are trying to insert something int the database "
                           "which already exists.")
    except FlushError:
        raise InvalidUsage("Your data was not formatted correctly; are you using an id which already exists?")



def post_new_resource(resource_type, request_json):
    new_resource = load_resource_from_schema(resource_type, request_json)

    try:
        db.session.add(new_resource)
        db.session.commit()
        return new_resource

    except IntegrityError as e:
        raise InvalidUsage("You're trying to load something that is already in the database.", payload=str(e))
    except ValueError as e:
        raise InvalidUsage("You are trying to load a resource that does not conform to database standards.",
                           payload={"details": {"resource": resource_type.__tablename__, "comments": str(e)}})

{% endhighlight %}

Thus, my new `GroceryList` post request becomes:

{% highlight python %}
@grocerylist.route("/lists", methods=["POST"])
@auth.login_required
def post_list():
    new_grocerylist = post_new_resource(GroceryList, request.json)
    return jsonify(grocerylist_schema.dump(new_grocerylist)), 201
{% endhighlight %}

Simple and extremely readable.

As of this writing, I am still working on generalizing the "PUT" request. There are a few details about it (namely the fact that not every attribute for the resource should be able to be changed) that are tripping me up, but I will have a writeup on solutions as soon as I finish. I was hoping to have all four in a single blog post, but time gets away from us all. Still, I'm quite pleased with my progress here. The endpoint code is much, much more readable and I feel like I have a better handle on the how and why of my program, rather than just the what. 
