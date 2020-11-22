---
layout: post
title: Constructing a More Complete Database Model
author: Steve
---

With the AJAX proof of concept complete, it was time to turn my attention to a more complicated database model, one that would hopefully sustain me for the foreseeable future. Why would I need a more complex database model? Simply put, because the old system does not store enough data.

Let me explain. The old model, storing a grocery list and a set of lines linked to the list, works for a single recipe, but the whole point of the app is to consolidate recipes, and that's where things quickly become more difficult. The fact that each line is stored as a string doesn't give the opportunity to consolidate ingredients and encourages redundant lines. Additionally, although the parser is getting ingredients, it's not doing anything with them except making those words a different color.

No, what I wanted was to be able to have a consolidated grocery list, and for that list to contain a number of cleaned up lines, with links to the original lines that they came from. I also wanted to be able to quickly sort the list by the different recipes, and make editing them easy and simple. For that, I was going to need a new set of models.

I came up with a four model system:
* A `RecipeList` model that stores entered recipes (like the original `GList` model)
* A `RawLine` model that stores the string line and some of the parsed information (like the original `Line` model)
* A  `CleanedLine` model that stores a cleaned up version of the lines, separaitng amount, ingredient, and measurement
* A `CompiledList` model that holds the `CleanedLine` models, the same way the `RecipeList` holds the `RawLines`

Here's the code setting up the database:

{% highlight python %}
class RecipeList(db.Model):
    id = db.Column(db.Integer, primary_key=True)  # the primary key
    name = db.Column(db.String, nullable=False)  # name for recipe (from url)
    hex_name = db.Column(db.String(20), unique=True, nullable=False)  # name for database
    image_file = db.Column(db.String(20), nullable=False, default='default.jpg')  # image for list
    recipe_url = db.Column(db.String(200), nullable=False)
    compiled_list = db.Column(db.ForeignKey('compiled_list.id'))    # the id of the compiled list
    lines = db.relationship('RawLine', backref='rlist', lazy=True)  # the lines of the list


class CompiledList(db.Model):
    id = db.Column(db.Integer, primary_key=True)    # the primary key
    name = db.Column(db.String(20), nullable=False, default="Unnamed List")  # user created name, optional
    hex_name = db.Column(db.String(20), unique=True, nullable=False)  # name for database
    lines = db.relationship('CleanedLine', backref='list', lazy=True)  # cleaned lines for the list
    recipes = db.relationship('RecipeList', backref='complist', lazy=True)  # all recipes that are in the compiled list


class RawLine(db.Model):
    id = db.Column(db.Integer, primary_key=True)  # the primary key
    id_in_list = db.Column(db.Integer, nullable=False)  # id in the grocery list (for requests)
    full_text = db.Column(db.String(100), nullable=False)  # the text of the line
    list_id = db.Column(db.Integer, db.ForeignKey('recipe_list.id'))  # the id of the list for the line
    cline_id = db.Column(db.ForeignKey('cleaned_line.id'))  # the id of the cleaned line
    text_to_colors = db.Column(db.String)


class CleanedLine(db.Model):
    id = db.Column(db.Integer, primary_key=True)   # the primary key
    id_in_list = db.Column(db.Integer)  # id in the grocery list (for requests)
    amount = db.Column(db.Float)    # the amount of ingredient (optional)
    measurement = db.Column(db.String(20))  # the measurement of the amount (optional)
    ingredient = db.Column(db.String(100), nullable=False)  # the ingredient (required)
    comp_list = db.Column(db.Integer, db.ForeignKey('compiled_list.id'))
    raw_lines = db.relationship('RawLine', backref='cleaned_line', lazy=True)   # the ingredient lines that were cleaned
{% endhighlight %}

Most of this is pretty straightforward. The trickiest part was figuring out all of the database relationships. SQL isn't the easiest thing to debug, I'm discovering. But I feel the relationships are important because, in the creation of the grocery list, users are going to need to track down, say the origin of a `CleanedLine` or get a list of all the recipes that a `CompliedList` is made of. And while there are probably a few more models I'm going to want to add (for example, establish users), I'm hopeful that this 4-model system will sustain me for a while, and I won't have to go mucking through SQLAlchemy for a while yet.

## Integrating the new model into the app

Next, it was time to make use of the new model. Because I still wanted the user to have input on cleaning the recipe lines, I modified my previous list page to become a sort of "cleaning" landing page, changing the routes accordingly. Then I added a "submit" form on the bottom that would generate the new list and redirect the user. Validating this form would then start the logic to actually clean the lines, going off of the user-aided data as a guide.

{% highlight python %}
@main.route('/clean/<string:hex_name>')
def clean_list(hex_name):
    form = RecipeCleanForm()
    if form.validate_on_submit():
        # TODO: create the compiled list here!

        # get the list
        rlist = RecipeList.query.filter_by(hex_name=hex_name).first_or_404()
        rlist_lines = RawLine.query.filter_by(rlist=rlist).all()

        # create combined list
        random_hex = secrets.token_urlsafe(8)
        combined_list = CompiledList(hex_name=random_hex)
        db.session.add(combined_list)
        db.session.commit()
        rlist.complist = combined_list
        db.session.commit()

        # create cleaned lines

        for line in rlist_lines:
            amount, measurement, ingredient = extract_ingredients(line.text_to_colors)
            if ingredient != '':  # only create cleaned line if we found an ingredient

                cleaned_line = CleanedLine(amount=amount,
                                           measurement=measurement,
                                           ingredient=ingredient,
                                           list=combined_list)

                db.session.add(cleaned_line)
                db.session.commit()

                line.cleaned_line = cleaned_line


        db.session.commit()
        return redirect(url_for('main.compiled_list', hex_name=combined_list.hex_name))

    rlist = RecipeList.query.filter_by(hex_name=hex_name).first_or_404()
    rlist_lines = RawLine.query.filter_by(rlist=rlist).all()

    rlist_lines = [LineToPass(line) for line in rlist_lines]

    return render_template('rlist.html', title="Your List", rlist=rlist, rlist_lines=rlist_lines, form=form)

{% endhighlight %}

Note the `extract_ingredients` function. This is a helper function that I put in my `utils.py` folder. It iterates through the JSON color data and extracts the ingredient, amount, and measurement, returning them:

{% highlight python %}
def extract_ingredients(color_string,
                        ingredient_color="text-success",
                        cardinal_color="text-warning",
                        quantity_color="text-primary"):
    ingredient = ''
    measurement = ''
    amount = 0
    color_dict = json.loads(color_string)
    for word, color in color_dict.items():
        if color == ingredient_color:
            ingredient += word + ' '
        elif color == cardinal_color:
            amount = float(sum(Fraction(s) for s in word.split()))  # treat the string as a fraction and sum
        elif color == quantity_color:
            try:
                amount = float(sum(Fraction(s) for s in word.split())) # see if the word is an amount
            except ValueError:  # if it's not an amount
                measurement += word + ' '

    return amount, measurement, ingredient
{% endhighlight %}

The only issue I have with this is that it doesn't support more than one ingredient on a line. That's a special use case I'm going to have to come back to.

But this essentially establishes the basic workflow for creating a new list: a user enters a url, it's parsed and they're taken to a "cleaning" page. From there, they will have the option to edit/help along the spaCy ingredient parser before submitting annotated lines. The program then cleans them up and spits out a `CompiledList` of `CleanedLines` on the main list page.

In order to test that it was all working, I put together an html template to print the compiled list. And all appears to be working properly:

![alt-text](/assets/img/posts/app-3/combined_list.png)

This was a difficult one; I'm still a bit shaky on databases and there were some errors that really had me tearing my hair out. It's also starting to dawn on me that this is a bigger project, maybe much bigger, than I originally had planned. But hey, that's part of the fun, right? The fact that it's hard shows it's worth doing.

### Next steps:
* add more than one recipe to a single lists
* give the option to select lists on main page
* fix the cleaning page so that it actually cleans

...and much much more. Until next time, Steve signing out.
