---
layout: post
title: The Grocery App Part 1 -- Building the Skeleton
author: Steve
---
And so begins the new adventure: a Flask application that makes use of the trained spaCy model to generate combined grocery lists. I started by creating a new Flask application. I decided to structure it with `Blueprints` from the beginning to avoid having to refactor later, and to make sure the lessons I'd learned were absorbed. Started with a single "main" blueprint for now.

The Flask tutorials I watched used Bootstrap, and so I decided to use it too. I understand that there's a `flask-bootstrap` module, but I decided that it would be better for me to take one thing at a time, and use basic Bootstrap to elevate it above the pure ugliness of raw HTML. I'll work on making everything look pretty later.

Before anything, I needed a form. I wanted something extremely simple that could be used to post a url:

{% highlight python %}
class RecipeURLForm(FlaskForm):
    url = StringField('URL', validators=[DataRequired(), URL()])
    submit = SubmitField("Find Ingredients")
{% endhighlight %}

I then put the form in a `jumbotron` div like so, and routed it to `'/'`. The idea is that first time users will come to this page and be prompted to enter a url for a recipe they like. The rest of the app will then be introduced later.

Again, nothing serious, just getting it out. But it works!

![alt text](/assets/img/posts/app-1/welcome-jumbotron.png)

At the same time, I'm now realizing a limitation of using jekyll for my blog: the `Jinja2` templates that I'm using in my html are picked up by jekyll, and are mucking up my code. So I'm afraid I'm going to have to stick to python code for the time being. Perhaps this is a strong sign that I should migrate this thing to something a bit more powerful.

But I digress. After building the basic form and loading page, I briefly tried to build a new route to direct the user to after they enter the url, but I soon realized that I wouldn't be able to pass enough information along without first parsing the relevant information into a database. So it was time to set up the basic database structure.

Still not entirely sure if I'm going to keep the database as is, but my basic structure stores a class of entries called `GList` that will have a name, id, and other important characteristics, and a reference to a series of `Lines`, a second structure class that will store the actual relevant information. Later, I'm going to link each `List` to a `User` class, but I'm getting ahead of myself.

First attempt at the basic database went as follows:

{% highlight python %}
from grocerylistapp import db

class GList(db.Model):
    id = db.Column(db.Integer, primary_key=True)  # the primary key
    name = db.Column(db.String(20), nullable=False, default="Unnamed List")  # user created name, optional
    hash_name = db.Column(db.String(20), unique=True, nullable=False)  # name for database
    image_file = db.Column(db.String(20), nullable=False, default='default.jpg')  # image for list
    lines = db.relationship('Line', backref='list', lazy=True)  # the lines of the list

    def __repr__(self):
        return f"{self.name}"

class Line(db.Model):
    id = db.Column(db.Integer, primary_key=True)  # the primary key
    full_text = db.Column(db.String(100), nullable=False)  # the text of the line
    list_id = db.Column(db.Integer, db.ForeignKey('g_list.id'))  # the id of the list for the line

    def __repr__(self):
        return f"{self.full_text}"
{% endhighlight %}

Follows my basic idea above, a `List` that's linked to a bunch of `Line`s. It shouldn't be that hard to add users later. Additionally, however, there is going to be some interplay between this `Line` object and the actual interior structure that spaCy finds; I think I may need to create a different database model for the actual grocery list lines; that way one can be edited independently of the other. Also note that I added an `image_file` line, mostly as a way to maybe add pictures to lists later on. It's not going to do much right now, though. 

But for now we're just trying to get everything in and working. One thing I will note here is that I got briefly stuck with my `ForeignKey` reference, because at first I wasn't sure how `SQLAlchemy` named its models. This led to a quick crash course on the SQLAlchemy homepage, so that's something I'm putting in my list of things to learn. But I caught the error, and was able to properly initialize the database from the python shell.

Returned to the home route and wrote code to create a new list after the url is entered:

{% highlight python %}
@main.route('/', methods=['GET', 'POST'])
def home():
    form = RecipeURLForm()
    if form.validate_on_submit():
        url = form.url.data
        recipe_lines = get_recipe_lines(url)
        random_hex = secrets.token_urlsafe(8)
        glist = GList(hex_name=random_hex)
        db.session.add(glist)
        db.session.commit()
        for line in recipe_lines:
            recipe_line = Line(full_text=line, list=glist)
            db.session.add(recipe_line)
        db.session.commit()
        return redirect(url_for('main.list_page', list_id=glist.hex_name))
    return render_template('home.html', title="Welcome!", form=form)

@main.route('/list/<string:list_id>', methods=['GET', 'POST'])
def list_page(list_id):
        glist = GList.query.filter_by(list_id=list_id).first_or_404()
        list_lines = Line.query.filter_by(list=glist).all()
        return render_template('glist.html', title="Your List", glist=glist, list_lines=list_lines)
{% endhighlight %}

A few things to note here:
* I query for the given list from the URL, and then pass the database into the template from there.
* I'm using a `secrets.token_urlsafe()` to generate a url-safe name for my list. Although the user will be able to rename it whatever they want, this is the name that the database will remember, and that the url will link to.
* The `get_recipe_lines()` method, right now, is just a `beautifulsoup` parser that only works for AllRecipes.com. It's what I used for my old command line app. This actually gave me a bit of a headache, because AllRecipes decided to change the name of the class that they use for recipe lines, and I had a bad moment where I thought my fancy new Flask database was messing up, when it was really just an error of web scraping. I caught the error, but it's something I need to keep in mind for the future; I may need to figure out a more robust way to scrape this data, if companies change these tags regularly.

I then created a basic template page to show that the information was going through. It's more of a proof of concept than anything else, but I wanted to be able to see that I could list the ingredients on the relevant page before I actually uploaded the spaCy model.

But finally, I was ready to test. And just look at this beauty!

![alt text](/assets/img/posts/app-1/list-works.png)

Yup. That's the hex name of my list, and all the ingredients from the recipe. It's a real thing of beauty, and although I've still got a *long* way to go, I feel that this project is off to a great start.
