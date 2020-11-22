---
layout: post
title: Coding the New Database
author: Steve
---

In a continuation of the [last post]({% post_url 2020-05-02-Designing-A-New-Database %}), today I'm going to go through the actual code that I've been using to set up the database, and explain why I made some of the choices I did. I will be using [flask-sqlalchemy](https://flask-sqlalchemy.palletsprojects.com/en/2.x/) and an SQLite database for my implementation, which is what I used last time as well.

### Ingredient and RecipeLine

Our first table is the `Ingredient` table.  

{% highlight python %}
# Represents an ingredient.
class Ingredient(db.Model):
    __tablename__ = 'ingredient'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, unique=True)    # the actual name of the ingredient

    # validator to ensure that an ingredient is in the proper form (all lower case, no dashes or other symbols)
    @db.validates('name')
    def validate_name(self, key, address):
        if not address.islower():
            raise ValueError("Ingredient must be in all lower case!")
        if not address.isalpha():
            raise ValueError("Ingredient must have only letters!")
        return address

    def __repr__(self):
      return f"<Ingredient '{%raw%}{self.name}{%endraw%}'>"
{% endhighlight python %}

Recall from my last post that the `Ingredient` table need only store the name of each ingredient. Originally, I'd planned for that name to be the primary key of the table, but seeing as ingredients could be an arbitrary length, I ultimately felt it was better to include a primary key table as well. I am specifying that the "name" attribute be `unique`, which more or less accomplishes the same goal.

Additionally, I've implemented a validator here that establishes a few base requirements for every ingredient. Namely, they must be in all lower case, and cannot contain any other characters. I'm adding this to reduce duplicates; the idea of storing "all-purpose flour" and "all-purpose flour" differently seems pointless. Note that there's nothing implemented at this point to convert a non-standard ingredient form into a standard form; I'll be adding that elsewhere. This is merely to serve as a last line of defense to make sure that improperly formatted data isn't added to the database.

Next up is the `RecipeLine` table.

{% highlight python %}
# Represents a line in a recipe. Can hold an arbitrary number of ingredients
class RecipeLine(db.Model):
    __tablename__ = 'recipe_line'
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String, nullable=False)  # the text of the line
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipe.id'), nullable=False)


    def __repr__(self):
        return f"<RecipeLine in '{self.recipe}' -- '{%raw%}{self.text[0:20]}{%endraw%}...' >"

{% endhighlight %}

Again, this table is straightforward. Each recipe line holds an `id`, the `text` of the line, and a `recipe_id` that relates to the `Recipe` it is a part of. We haven't implemented the `Recipe` table yet, but `'recipe.id'` will be the name of the primary key for the `Recipe` table.

Additionally, with these two classes implemented, we can build our first association table, between the `RecipeLine`s and associated `Ingredients`.

{% highlight python %}
# association table between RecipeLine and Ingredient models (many-to-many relationship)
line_ingredient_associations = db.Table('line_ingredient_associations',
                                        db.Column('ingredient', db.Integer, db.ForeignKey('ingredient.id')),
                                        db.Column('recipe_line', db.Integer, db.ForeignKey('recipe_line.id'))
                                        )
{% endhighlight %}

We then add two `relationship` attributes, one for `Ingredient` and one for `RecipeLine`. I chose to use the `back_populates` attribute rather than the `backref` attributed because I like the additional control provided by the former.

{% highlight python %}
# in the Ingredient class:
recipe_lines = db.relationship("RecipeLine",    # lines where this ingredient appears.
                               secondary=line_ingredient_associations,
                               back_populates='ingredients')

# in the RecipeLine class:
ingredients = db.relationship("Ingredient",   # ingredients in the line
                              secondary=line_ingredient_associations,
                              back_populates="recipe_lines")
{% endhighlight %}

Now the association is established, but there's still one final check to make: we need to make sure that any `Ingredient` added to a line is actually *in* the line. This is accomplished by another pair of validators, one in `Ingredient` and one in `RecipeLine`, which compare the `name` attribute of `Ingredient` to the `text` attribute of `RecipeLine`, to confirm that the `Ingredient` actually does appear in the `RecipeLine`.

{% highlight python %}
# in Ingredient class:
@db.validates('recipe_lines')
def validate_recipe_line(self, key, address):
    if self.id not in address.text:
        raise ValueError("Ingredient not in line!")
    return address

# in RecipeLine class:
@db.validates('ingredients')
def validate_ingredient(self, key, address):
    if address.id not in self.text:
        raise ValueError("Ingredient not in recipe line!")
    return address
{% endhighlight %}

Again, these should never be called, as our program will hopefully be smart enough to never try to add an `Ingredient` to a `RecipeLine` that doesn't feature it. But if it does, we're covered.

### Recipes

Next up is the `Recipe` class. This one consists of a `name`, a `url`, and a collection of `RecipeLine`s.

{% highlight python %}
# Represents a recipe. Can relate to an arbitrary number of RecipeLines, many-to-one
class Recipe(db.Model):
    __tablename__ = 'recipe'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    url = db.Column(db.String(200))     # url of where the recipe was gotten (if applicable)
    recipe_lines = db.relationship("RecipeLine", back_populates='recipe')

    def __repr__(self):
        return f"<Recipe '{%raw%}{self.name}{%endraw%}'>"
{% endhighlight %}

Now that we've implemented the `Recipe` class, we can add a `relationship` attribute back to the `RecipeLine` class:

{% highlight python %}
# in RecipeLine class
recipe = db.relationship("Recipe", back_populates="recipe_lines")
{% endhighlight %}

Since the relationship between `Recipe`s and `RecipeLine`s is one-to-many, we don't need an association table here.

### GroceryLists and Users

Now, we implement a `GroceryList` class to represent the actual lists. On it's own, it holds nothing except a `name` and an `id`.

{% highlight python %}
lass GroceryList(db.Model):
    __tablename__ = 'grocery_list'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)

    def __repr__(self):
        return f"<GroceryList '{%raw%}{self.name}{%endraw%}'>"

{% endhighlight %}

However, the addition of `GroceryList`s means we can add our second association table, which links `Recipe`s and `GroceryList`s.

{% highlight python %}
# association table between Recipe and GroceryList models (many-to-many relationship)
recipe_list_associations = db.Table('recipe_list_associations',
                                    db.Column('recipe', db.Integer, db.ForeignKey('recipe.id')),
                                    db.Column('grocery_list', db.Integer, db.ForeignKey('grocery_list.id'))
                                    )

# relationship in the Recipe class
grocery_lists = db.relationship("GroceryList",
                                secondary=recipe_list_associations,
                                back_populates="recipes")

# relationship in the GroceryList class
recipes = db.relationship("Recipe",
                          secondary=recipe_list_associations,
                          back_populates="grocery_lists")
{% endhighlight %}

This gives us our many-to-many relationship between `Recipe`s and `GroceryList`s, ensuring that a user could reuse a given `Recipe` for a new `GroceryList`. It also means, theoretically, that a user could have a `GroceryList` with a `Recipe` on it that they did not create, and I'm going to have to check for that when I start adding permissions. I like the idea of a user being able to use a `Recipe` they didn't add, but not being able to alter the ingredients on it. If they want to alter them, they can make a copy. But I'm getting ahead of myself.

Our final main table is the `User` table, which holds an `email`, a `hashed_password`, and an `access_level`.

{% highlight python %}
# Represents a user. Can relate to an arbitrary number of GroceryLists
class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), nullable=False)
    hashed_password = db.Column(db.String(16), nullable=False)
    access_level = db.Column(db.Integer, nullable=False, default=0)
    grocery_lists = db.relationship("GroceryList",
                                    secondary=user_list_associations,
                                    back_populates="users")

    def __repr__(self):
        return f"<User {%raw%}{id} -- email:'{self.email}' access_level: {self.access_level}{%endraw%}>"
{% endhighlight %}

We can also add our final association table, with the necessary `relationship`s in `GroceryList` and `User`.

{% highlight python %}
# association table between GroceryList and User models (many-to-many relationship)
user_list_associations = db.Table('user_list_associations',
                                  db.Column('grocery_list', db.Integer, db.ForeignKey('grocery_list.id')),
                                  db.Column('user', db.Integer, db.ForeignKey('user.id'))
                                  )

# in GroceryList class
users = db.relationship("User",
                        secondary=user_list_associations,
                        back_populates="grocery_lists")

# in Users class
grocery_lists = db.relationship("GroceryList",
                                secondary=user_list_associations,
                                back_populates="users")
{% endhighlight %}

This ensures that each `User` can own an arbitrary number of `GroceryList`s, and each `GroceryList` can be owned by an arbitrary number of `User`s.

And with that, the setup of the database is complete. I'll probably need to go back and tweak a few things, but overall the implementation was really smooth. As I'm writing this, I'm pretty deep into serializing everything (teaser for my next post), and so far this implementation has served me really well. All in all, I'm very glad that I took the time to sit down and plan this out; it feels like a much, much stronger foundation for my app.

#### Next Steps
* integrate `flask-marshmallow` to serialize all the objects
* begin construction of the api endpoints
