---
layout: post
title: First Patch, with Notes on Scraping
author: Steve
---

So I've just released my first patch for the recipe parser, which took care of a few of the more glaring issues that the program still needed. Most notable was a bug that prevented a number of screens from being showed due to an errant variable in my `layout.html` file. I removed the offending variable and set the guest users to be automatically redirected to their list when they click the "home" button instead.

More importantly, however, I added support for a number of additional recipes, and worked on the architecture for my web scraper. This has been a fun bit of coding; because there are so many different recipe websites out there, implementing them one by one is very tedious and I was incentivized to come up with ways to avoid repetition as much as possible.

For the recipes I've looked at so far, I've found several different patterns for how they store their recipe lines and titles. The first, and simples, is an `html` component with a specified attribute. In these cases, the same `BeautifulSoup` command can essentially be run, and I just change out the parts that I look for. Here's the start of the dictionary I use for these cases:

{% highlight python %}
ingredient_parsers = {
    "www.allrecipes.com": {
        "title": ("h1", "id", "recipe-main-content"),
        "lines": ("span", "class", "recipe-ingred_txt")
    },
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
{% endhighlight %}

I parse the url and check if the main domain is in the dictionary. If it is, then I retrieve the necessary component names and scrape accordingly:

{% highlight python %}
parsing_information = ingredient_parsers.get(o.netloc, "")

    if parsing_information:
        print("found for ", parsing_information)
        # get information for the title
        component, attribute, name = parsing_information["title"]

        try:
            recipe_title = soup.find(component, {attribute: name}).get_text()
        except AttributeError:
            recipe_title = soup.title.get_text()  # we get some kind of name if we can't parse the actual recipe

        # get information for the lines
        component, attribute, name = parsing_information["lines"]
        ingredients = soup.find_all(component, {attribute: name})
        ingredient_lines = [line.get_text() for line in ingredients]
{% endhighlight %}

(Here, "o" is a `urlparse` object initialized with the provided url.)

Of course, some websites are a bit more complicated. For these, I actually have to make a specific function to scrape from them. I tried to make this as easy as possible as well, however, by creating a second dictionary that stores the functions:

{% highlight python %}
def get_recipe_food52(soup):
    print("getting from food52")
    ingredient_div = soup.find("div", {"class": "recipe__list"})
    ingredient_list = ingredient_div.find("ul")
    ingredient_items = ingredient_list.find_all("li")

    ingredient_lines = []

    for line in ingredient_items:
        line = line.text.replace("\n", " ")
        s_line = line.split()
        line = " ".join(s_line)
        ingredient_lines.append(line)

    try:
        title = soup.find("h1", {"class": "recipe__title"}).get_text()
    except AttributeError:
        title = soup.title.get_text()

    return {
        "title": title,
        "recipe_lines": ingredient_lines
    }

...

ingredient_functions = {
    "food52.com": get_recipe_food52,
    ...
{% endhighlight %}

This way, I can check if the domain name is in the second list, and return the information right then and there:

{% highlight python %}
elif o.netloc in ingredient_functions:
    return ingredient_functions[o.netloc](soup)
{% endhighlight %}

There are a few other small tricks that I'm using to make this process easier. For one, many of the recipe blogs are Wordpress based, and use one of the many Wordpress plugins for recipe blogs. I created standard templates for the websites that use them, such as this one for Wordpress Recipe Maker:

{% highlight python %}
# repeated attributes for sites using WordPress Recipe maker
wprm_scrapers = {
    "title": ("h2", "class", "wprm-recipe-name"),
    "lines": ("li", "class", "wprm-recipe-ingredient")
}
...
# in my main ingredient_parsers dictionary
"minimalistbaker.com": wprm_scrapers,
"www.budgetbytes.com": wprm_scrapers
{% endhighlight %}

Another plugin requires its own function to parse, but luckily that function can be used on more than one recipe:

{% highlight python %}
# function for scraping websites that use the TastyRecipes plugin
def get_recipe_tastyrecipes(soup):
    ingredient_div = soup.find("div", {"class": "tasty-recipe-ingredients"})
    ingredient_lines = ingredient_div.find_all("li")
    recipe_lines = []
    for line in ingredient_lines:
        recipe_lines.append(line.text)
        print(line.text)

    recipe_title_div = soup.find("div", {"class": "tasty-recipes"})
    recipe_title = recipe_title_div.find("h2")

    return {
        "title": recipe_title.text,
        "recipe_lines": recipe_lines
    }

...

# in ingredient_functions dictionary:
"cookieandkate.com": get_recipe_tastyrecipes,

{% endhighlight %}

... and so on and so forth. There are a *lot* of sites out there, and there's no way I could get them all, but I'd like to have enough that the odds are fairly good you'll be using a site that's covered. Regardless, I had quite a bit of fun working on this code; one of the things I enjoy the most is figuring out new ways to solve problems that would require a lot of busy work to do otherwise. Writing out a specified function for every single recipe website would have been a lot of unneeded work.

Anyway, that's all I've got for now, but I'll be posting some new updates to the recipe parser as I go. I have a feeling that I'm almost done with this one, at least for now. Huh, finishing a project. Great feeling.
