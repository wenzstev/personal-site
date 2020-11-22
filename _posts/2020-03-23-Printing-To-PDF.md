---
layout: post
title: Exporting a List to a PDF
author: Steve
---

So I've now reached a point where I'm moderately satisfied with the number of features that one can use to customize and change their lists as they need. While I would like to go back and smooth over some rough edges, it's time to move on to a different area of work and continue my march to feature completeness.

It's time to enable exporting of the list. While it's true that I'm designing this as a mobile-friendly web app, I feel that some users might want a simpler way to access their list when it actually comes time to use it. To that end, I want to have several ways to export the list. The most important of these are the ability to export to a pdf, and the ability to email the list. If possible, I would also like to give the user the ability to text the list to themselves, but I'm not as certain of how to do that.

But let's start with the pdf. After some googling and searching, I found [this tutorial](https://www.youtube.com/watch?v=C8jxInLM9nM), which makes use of [wkhtmltopdf](https://wkhtmltopdf.org/) and [pdfkit](https://github.com/JazzCore/python-pdfkit) to turn a rendered template into a pdf. After installing modules and adding wkhtmltopdf to my PATH, I began to code.

First I created a new route that would render the list in a pdf:

{% highlight python %}
@main.route('/list/<string:hex_name>/print')
def print_list(hex_name):
    list = CompiledList.query.filter_by(hex_name=hex_name).first_or_404()
    list_lines = CleanedLine.query.filter_by(list=list).all()

    list_lines = [CompiledIngredientLine(line) for line in list_lines]

    rendered = render_template('print_template.html', list=list, lines=list_lines)

    pdf = pdfkit.from_string(rendered, False)

    response = make_response(pdf)
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = 'inline; filename=output.pdf'

    return response

{% endhighlight %}

This route renders a jinja template the same way any of the other routes do, except it then turns that template into a pdf. From there, it configures the client to expect a pdf as a response, and returns the response. Here's the template that I first used:

{% highlight html %}
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">


    <!-- Bootstrap Links -->
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css">
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js"></script>
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/js/bootstrap.min.js"></script>

    <link rel="stylesheet" href="{%raw%}{{url_for('static', filename='main.css')}}{%endraw%}">
    <style>
        li {
            margin-bottom: 10px;
            font-size: large;
        }
    </style>
</head>

<body>
<h1>{%raw%}{{list.name}}{%endraw%}</h1>

<ul>
{%raw%}{% for line in lines %}{%endraw%}
    {%raw%}{% if not line.checked %}{%endraw%}
        <li>{%raw%}{{line.ingredient}}{%endraw%}</li>
    {%raw%}{% endif %}{%endraw%}
{%raw%}{% endfor %}{%endraw%}
</ul>
</body>
{% endhighlight %}

I didn't use my `layout.html` template because I didn't want the navbar, but I did include bootstrap (for now), mainly because I wanted to keep everything the same style. I gave the program a test, and the template rendered successfully:

![alt text](/assets/img/posts/export-recipe/pdf-take-one.png)

Excellent. Now, I could have been done here, but I decided that I wanted to add a little extra customization to how the pdf was generated. Plus, I needed to add a way to access the `/print` route from the main list page.

I went into my `forms.py` folder and created a new form, `ExportToPDFForm`, that contained a few checkboxes for different aspects of the data that a person might want to include in their grocery list, such as the recipes and whether or not the program should display checked lines.

{% highlight python %}
class ExportToPDFForm(FlaskForm):
    show_checked = BooleanField("Show checked off ingredients: ")
    show_recipes = BooleanField("Show Recipes: ")
    show_lines = BooleanField("Show recipe lines: ")
    submit = SubmitField("Export to PDF")
{% endhighlight %}

Then, I added this new form to the list page, attaching it to a modal. I seem to be using a lot of these, but can you blame me? I like the way they look and they add additional features without cluttering up the main page too much. If it becomes overbearing I may change it, but the relentless pace of progress stops for no one.

I attached the modal to a "Print" `<button>` and placed it underneath the list name:

{% highlight html %}
<div id="complist-name-div">
    <h1 id="complist-name">{%raw%}{{ comp_list.name }}{%endraw%}</h1>
    <button id="rename-list-button" class="btn btn-secondary">Rename</button>
</div>
<div id="list-tool-panel">
    <button data-toggle="modal" data-target="#printModal" class="btn btn-info">Print</button>
</div>
...

<!-- Modal Print -->
<div class="modal fade" tabindex="-1" id="printModal" role="dialog" aria-labelledby="deleteModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="printModalLabel">Print List</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">x</span>
                </button>
            </div>
            <div class="modal-body">
                <form method="POST" target="_ blank" action="{%raw%}{{ url_for('main.print_list', hex_name=comp_list.hex_name) }}{%endraw%}">
                    {%raw%}{{export_to_pdf_form.hidden_tag()}}{%endraw%}
                    <fieldset>
                        <div>
                        {%raw%}{{export_to_pdf_form.show_checked.label}}{%endraw%}
                        {%raw%}{{export_to_pdf_form.show_checked(class="form-check")}}{%endraw%}
                        </div>
                        <div>
                        {%raw%}{{export_to_pdf_form.show_recipes.label}}{%endraw%}
                        {%raw%}{{export_to_pdf_form.show_recipes(class="form-check")}}{%endraw%}
                        </div>
                         <div>
                        {%raw%}{{export_to_pdf_form.show_lines.label}}{%endraw%}
                        {%raw%}{{export_to_pdf_form.show_lines(class="form-check")}}{%endraw%}
                        </div>
                    </fieldset>
                    {%raw%}{{export_to_pdf_form.submit(class="btn btn-submit")}}{%endraw%}
                </form>
            </div>
        </div>
    </div>
</div>
{% endhighlight %}

This created a nice button...

![alt text](/assets/img/posts/export-recipe/print-button.png)

...which, when clicked, produces a nice modal...

![alt text](/assets/img/posts/export-recipe/print-modal.png)

Now that I had the data, I just needed to do something with it. As you may have noticed in the form data above, I set the form to redirect to my `/print` route. Then I rewrote the route so that it fetched more of the necessary data, including the `RawLines` and the `RecipeList`s associated with I also made a quick rewrite to my list sorting function, moving it to `utils.py` so that I could reorder the list on the print screen.

{% highlight python %}
@main.route('/list/<string:hex_name>/print', methods=['POST'])
def print_list(hex_name):
    print(request.form)
    list = CompiledList.query.filter_by(hex_name=hex_name).first_or_404()
    list_lines = CleanedLine.query.filter_by(list=list).all()

    sort_list(list_lines)  # new function in utils.py

    list_lines = [CompiledIngredientLine(line) for line in list_lines]
    list_recipes = RecipeList.query.filter_by(complist=list).all()

    # reverse list and remove "additional ingredients" recipe
    list_recipes.reverse()
    list_recipes = [recipe for recipe in list_recipes if recipe.name != "Additional Ingredients"]

    rendered = render_template('print_template.html',
                               list=list,
                               lines=list_lines,
                               list_recipes=list_recipes,
                               print_checked=request.form.get("export-pdf-show_checked", "n"),
                               print_recipes=request.form.get("export-pdf-show_recipes", "n"),
                               print_lines=request.form.get("export-pdf-show_lines", "n"))

    pdf = pdfkit.from_string(rendered, False)

    response = make_response(pdf)
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = 'inline; filename=output.pdf'

    return response
{% endhighlight %}

Finally, I went back into my pdf template and changed the code so that it displayed the proper information, but only if the relevant boxes had been checked:

{% highlight html %}
<h1>{{list.name}}</h1>

<ul>
    {%raw%}{% for line in lines %}{%endraw%}
        {%raw%}{% if print_checked == "n" %}{%endraw%}
            {%raw%}{% if not line.checked %}{%endraw%}
                <li>{%raw%}{{line.ingredient}}{%endraw%}</li>
                {%raw%}{% if print_lines == "y" %}{%endraw%}
                    <ul>
                        {%raw%}{% for raw_line in line.raw_lines %}{%endraw%}
                            <li>{%raw%}{{raw_line.full_text}}{%endraw%} <span style="font-style: italic">{%raw%}{{raw_line.recipe.name}}{%endraw%}</span></li>
                        {%raw%}{% endfor %}{%endraw%}
                    </ul>
                {%raw%}{% endif %}{%endraw%}
            {%raw%}{% endif %}{%endraw%}
        {%raw%}{% else %}{%endraw%}
            <li>{%raw%}{{line.ingredient}}{%endraw%}</li>
            {%raw%}{% if print_lines == "y" %}{%endraw%}
                    <ul>
                        {%raw%}{% for raw_line in line.raw_lines %}{%endraw%}
                            <li>{%raw%}{{raw_line.full_text}}{%endraw%} <span style="font-style: italic">{%raw%}{{raw_line.recipe.name}}{%endraw%}</span></li>
                        {%raw%}{% endfor %}{%endraw%}
                    </ul>
                {%raw%}{% endif %}{%endraw%}
        {%raw%}{% endif %}{%endraw%}
    {%raw%}{% endfor %}{%endraw%}
</ul>
{%raw%}{% if print_recipes=="y" %}{%endraw%}
    <h1> Recipes </h1>
    <ul>
        {%raw%}{% for recipe in list_recipes %}{%endraw%}
            <li>{%raw%}{{recipe.name}}{%endraw%}</li>
        {%raw%}{% endfor %}{%endraw%}
    </ul>
{%raw%}{% endif %}{%endraw%}
{% endhighlight %}

A lot of templating going on here, and I'm still not totally satisfied with how the printed list looks. But the pieces are in place, and I plan to give it another pass when I come back through for beautification.

![alt text](/assets/img/posts/export-recipe/lines-in-pdf.png)

![alt text](/assets/img/posts/export-recipe/recipe-in-pdf.png)

#### Next Steps

* email the list to a provided address
* text the list to a provided number
