---
layout: post
title: Refactoring Modals
author: Steve
---

This is just a quick blog post I wanted to get out as an update to how I've implemented modals, as I feel that my old implementation was a bit of an antipattern.

### Old Method

Previously, I had implemented the modal component in the `SearchBar` component, because it was activated by the `NavMenu` component that was nested within. The actual contents of the modal were passed as state. You can read [this post]({% post_url 2020-08-06-Adding-Recipes-and-Lists %}) for more details of how I implemented it.

This method worked, so long as modals only needed to be accessed from the searchbar. The problem came when I didn't want to do that anymore. In trying to figure out how to open the modal from the contents of the main page, I realized that I had been implementing my templates somewhat backwards. Essentially, I was rendering my `MainTemplatePage` component as a *child* of the various other pages, rather than vice versa. This meant that, if I wanted to activate the modal through the pages, I would need to store the state of the modal in the page, rather than the template. As you might imagine, this sort of defeated the purpose of the template.

### New Method

First, I rearranged the nesting of my pages. Rather than storing the `MainTemplatePage` in each other page, I routed the pages *through* `MainTemplatePage` on my top level route. To make everything a bit cleaner, I combined the `Route` component with the `MainTemplatePage` component.

{% highlight javascript %}
const PageRoute = (props) => {
  console.log("in page route")
  return (
    <Route path={props.path}>
      <MainTemplatePage>
        {props.children}
      </MainTemplatePage>
    </Route>
  )
}
{% endhighlight %}

I then used this component for my actual routes, like so.

{% highlight javascript %}
const AuthenticatedApp = (props) => {
  return (
      <Switch>
        <PageRoute path="/recipes">
          <RecipePage />
        </PageRoute>
        <PageRoute path="/lists">
          <ListPage />
        </PageRoute>
        // ...and so on
{% endhighlight %}

Now that the `MainTemplatePage` was the parent of the individual pages, I could then pass down necessary modal information. I moved the modal to the `MainTemplatePage` and created a new component, `BaseModal`, that rendered the modal outside the main DOM structure as a portal.

{% highlight javascript %}
const BaseModal = (props) =>{
  const classes = useStyles(props)
  const [modalStyle] = useState(modalStyles)


  const modal = (
    <Modal style={modalStyle} open={props.open} onClose={props.handleClose}>
      <Paper className={classes.modalPaper}>
      {props.children}
      </Paper>
    </Modal>
  )

  return ReactDOM.createPortal(modal, document.querySelector("#modal"))
}

// in MainTemplatePage
return (
  <div className={classes.root}>
    {props.noSearchbar ? null : <SearchBar openModal={openModal}/>}
    <Container>
        {childrenWithProps}
    </Container>
    <BaseModal className={classes.modal} open={modalOpen} handleClose={closeModal}>
      {modal}
    </BaseModal>
  </div>
)

{% endhighlight %}

To be honest, I'm not entirely sure this is necessary, as I suspect Material-UI does something similar under the hood. But it seems to be best practices for modals in general, so I'm going to keep it for now.

I still had one more issue, however. While I could pass down the necessary modal information to the children, I couldn't do so statically, as `MainTemplatePage` didn't actually know what its children would be. My solution (which comes from [this](https://stackoverflow.com/questions/32370994/how-to-pass-props-to-this-props-children) StackOverflow question) was to map the children and clone them with the props added.

{% highlight javascript %}
const openModal = (modal) => {
  setModalOpen(true)
  setModal(modal)
}

// ...

const childrenWithProps = React.Children.map(props.children, child =>{
  const props = {openModal}
  if (React.isValidElement(child)){
    return React.cloneElement(child, props)
  }
  return child
})
{% endhighlight %}

This is why I render the `childrenWithProps` variable rather than the `props.children` variable in the return statement of my `MainTemplatePage` component.
With this implemented, I can now access the necessary modal information in any component that is a direct child of the `MainTemplatePage`. For example, in my `ListPage` component, I can return:

{% highlight javascript %}
return (
  <Grid container>
    <CreateNewCard type="List" clickHandler={()=>props.openModal(<AddListModal />)}/>
    {lists ? lists.map((value, index) => <ListCard key={index} list={value} />) : null}
  </Grid>
)
{% endhighlight %}

# Conclusion

While it's still not a perfect system, this change keeps the actual modal component dumb, since I can pass any modal I want into it. It also adds a great deal more flexibility in where I can access modals. It's not a huge change, but I wanted to make note of it before I moved on to adding List functions.
