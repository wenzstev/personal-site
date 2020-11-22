---
layout: post
title: An Interlude to Refactor
author: Steve
---

It's almost time to implement the final area of my Grocery App -- the ability to create an account and save your lists there. However, before I take this step, I wanted to take a day or two to prep my code for this, and to figure out how I could refactor it into something that will better handle the additional complexity. After all, my `routes.py` file has been getting very long, and while I wouldn't quite call my code "spaghetti" (I hope not, at least), I was beginning to feel as though it was growing a bit to big for its shell.

It was time to split things up.

After some thought about how best to do so, I decided to split my routes into five different blueprints:
* the `main` blueprint, which would currently only include the homepage, but later might include an "About" page or other pages that lack a specific association with a grocery list,
* a `checklist` blueprint, which would hold all the routes associated with the `CompiledList` model, such as the main list page and the routes to delete and rename a list,
* a `line` blueprint, which would hold all the routs associated with a specific line, either a `CleanedLine` or a `RawLine`. At some point in the future, I might break up these two line types,
* a `recipe` blueprint, which would hold all the routes associated with a specific recipe, namely the "Add Recipe" page,
* a `users` blueprint, which will hold all the routes associated with the users.

With this general skeleton in mind, I got to work. I'm pleased to say that most of my code separated fairly easily, which I'm hoping is a sign that I generally wrote it well. There were a few areas, however, that stayed tangled, and after some thought I had to check myself and think about why and how I was splitting it up the way I was. In particular, many of the functions in `utils.py` were being used by more than one separated route. At first, I got around this by using POST redirects, such as on my homepage:

{% highlight html %}
<form method="POST" action="{%raw%}{{url_for('checklist.create', method='url')}}{%endraw%}">
...
<form method="POST" action="{%raw%}{{url_for('checklist.create', method='manual')}}{%endraw%}">
{% endhighlight %}

... and then directing them to a new route, which effectively ran the same code that the `main.home` route ran on its respective calls to `validate_on_submit()`:

{% highlight python %}
@checklist.route('/list/create/<string:method>', methods=['POST'])
def create(method):
    new_list = create_list()

    # figure out how the list was created
    print(request.form)

    if method == 'blank':
        return redirect(url_for('checklist.compiled_list', hex_name=new_list.hex_name))

    elif method == 'url':
        # take the url input and parse for ingredient lines
        new_recipe = create_recipe_from_url(request.form.get('url-url', '', type=str))
        new_recipe.complist = new_list

    elif method == 'manual':
        new_recipe = create_recipe_from_text('Untitled Recipe', request.form.get('custom-recipe_lines', '', type=str))
        new_recipe.complist = new_list

    else:
        abort(404)

    return redirect(url_for('recipe.clean_recipe', list_name=new_list.hex_name, new_recipe=new_recipe.hex_name))
{% endhighlight %}

At first, this struck me as a fairly elegant solution, since I could simply redirect the necessary logic between routes and keep everything nicely separated. However, I soon realized that doing so would lead to two problems:
1. It encouraged a lot of redirects, and
2. (more importantly) often the POST data that the forms provided involved more than one "area," resulting in a situation where keeping helper functions in one package excluded them from another package. I could get around this by importing from another package, but that kind of defeated the purpose of having different packages in the first place.

This, plus the fact that, when I looked online I couldn't really see any examples of someone using Flask this way, made me paranoid that I was abandoning best practices, so I hit the brakes on this method.

After some more thought, it seemed to me that I was following the letter of the law too closely and ignoring the spirit of the thing. In the name of perfect organization and modularity, I was overcomplicating my code. And besides, there isn't any law that states that helper functions *need* to be associated with only a single blueprint. I decided instead to take the helper functions that needed to be accessed in more than one place and put them in the main package instead. I created a `constructors.py` module for functions associated with building `RecipeList`s and `CompiledList`s, and created an `nlp.py` module for any function that deals with spaCy model. Other helper functions that only concerned one blueprint were put into a `utils.py` folder unique to that blueprint. I ended up with this file structure:

![alt text](/assets/img/posts/refactoring/new-directory.png)

It took a little while to go through and make sure everything was linked up properly, but I'm pleased with the result. I suspect that my code still needs additional refactoring, but I plan to do another, more intensive pass after implementing the user features; this was more to clear the way for those additions. My hope is that, once this is feature complete, I can go through and smooth over some areas that are still kind of rocky.

One final note before I close this out: halfway through refactoring this I realized how nice it would be if I'd implemented version control. I'd been meaning to get this app on github for a while, but this finally pushed me over the edge. You can see it [here](https://github.com/wenzstev/grocerylistapp), and I'll be updating it as I go.

#### Next Steps:
* add users (it's a big one)
