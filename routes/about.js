
/*
 * GET about page.
 */

exports.show = function(req, res){
  res.render('about', { title: 'About me' }); 
};