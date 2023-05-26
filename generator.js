'use strict';
let pagination = require('hexo-pagination');
let _pick = require('lodash.pick');
let fs = require("fs")

function filterHTMLTags(str) {
  return str ? str
    .replace(/\<(?!img|br).*?\>/g, "")
    .replace(/\r?\n|\r/g, '')
    .replace(/<img(.*)>/g, ' [Figure] ') : null
}
function fetchCovers(str) {
  var temp,
    imgURLs = [],
    rex = /<img[^>]+src="?([^"\s]+)"(.*)>/g;
  while (temp = rex.exec(str)) {
    imgURLs.push(temp[1]);
  }
  return imgURLs.length > 0 ? imgURLs : null;
}
function fetchCover(str) {
  let covers = fetchCovers(str)
  return covers ? covers[0] : null;
}
function readMd(source){
  return fs.readFileSync(source, 'utf8')
}

module.exports = function (hexo, site) {
  let cfg = Object.assign({}, hexo.config, hexo.theme.config)
  let restful = cfg.hasOwnProperty('restful_api') ? cfg.restful_api :
    {
      site: true,
      posts_size: 10,
      posts_props: {
        title: true,
        slug: true,
        date: true,
        updated: true,
        comments: true,
        cover: true,
        path: true,
        raw: false,
        excerpt: false,
        content: false,
        categories: true,
        tags: true
      },
      categories: true,
      use_category_slug: false,
      tags: true,
      use_tag_slug: false,
      post: true,
      pages: false,
      swipers_list: [],
      search_all: {
        enable: true,
        path: 'api/search.json',
        field: 'post',
        content: true
      }
    },

    posts = site.posts.sort('-date').filter(function (post) {
      return post.published;
    }),

    posts_props = (function () {
      var props = restful.posts_props;

      return function (name, val) {
        return props[name] ? (typeof val === 'function' ? val() : val) : null;
      }
    })(),
    postMap = function (post) {
      return {
        title: posts_props('title', post.title),
        slug: posts_props('slug', post.slug),
        date: posts_props('date', post.date),
        updated: posts_props('updated', post.updated),
        comments: posts_props('comments', post.comments),
        path: posts_props('path', 'api/articles/' + post.slug + '.json'),
        excerpt: posts_props('excerpt', filterHTMLTags(post.excerpt)),
        keywords: posts_props('keywords', cfg.keywords),
        cover: posts_props('cover', post.img || post.cover || fetchCover(post.content)),
        content: posts_props('content', readMd(post.full_source)),
        raw: posts_props('raw', post.raw),
        categories: posts_props('categories', function () {
          return post.categories.map(function (cat) {
            let name = (
              cfg.restful_api.use_category_slug && cat.slug
            ) ? cat.slug : cat.name;
            return {
              name: name,
              path: 'api/categories/' + name + '.json'
            };
          });
        }),
        tags: posts_props('tags', function () {
          return post.tags.map(function (tag) {
            let name = (
              cfg.restful_api.use_tag_slug && tag.slug
            ) ? tag.slug : tag.name;
            return {
              name: name,
              path: 'api/tags/' + name + '.json'
            };
          });
        })
      };
    },

    cateReduce = function (cates, kind) {
      return cates.reduce(function (result, item) {
        if (!item.length) return result;

        let use_slug = null;
        switch (kind) {
          case 'categories':
            use_slug = cfg.restful_api.use_category_slug;
            break;
          case 'tags':
            use_slug = cfg.restful_api.use_tag_slug;
            break;
        }

        let name = (use_slug && item.slug) ? item.slug : item.name;

        return result.concat(pagination(item.path, posts, {
          perPage: 0,
          data: {
            name: name,
            path: 'api/' + kind + '/' + name + '.json',
            postlist: item.posts.map(postMap)
          }
        }));
      }, []);
    },

    catesMap = function (item) {
      return {
        name: item.data.name,
        path: item.data.path,
        count: item.data.postlist.length
      };
    },

    cateMap = function (item) {
      var itemData = item.data;
      return {
        path: itemData.path,
        data: JSON.stringify({
          name: itemData.name,
          postlist: itemData.postlist
        })
      };
    },
    apiData = [];

  if (restful.site) {
    apiData.push({
      path: 'api/site.json',
      data: JSON.stringify(restful.site instanceof Array ? _pick(cfg, restful.site) : cfg)
    });
  }
  if (restful.categories) {

    let cates = cateReduce(site.categories, 'categories');

    if (!!cates.length) {
      apiData.push({
        path: 'api/categories.json',
        data: JSON.stringify(cates.map(catesMap))
      });

      apiData = apiData.concat(cates.map(cateMap));
    }

  }

  if (restful.tags) {
    let tags = cateReduce(site.tags, 'tags');

    if (tags.length) {
      apiData.push({
        path: 'api/tags.json',
        data: JSON.stringify(tags.map(catesMap))
      });

      apiData = apiData.concat(tags.map(cateMap));
    }

  }

  let postlist = posts.map(postMap);

  if (restful.posts_size > 0) {

    var page_posts = [],
      i = 0,
      len = postlist.length,
      ps = restful.posts_size,
      pc = Math.ceil(len / ps);

    for (; i < len; i += ps) {
      page_posts.push({
        path: 'api/posts/' + Math.ceil((i + 1) / ps) + '.json',
        data: JSON.stringify({
          total: len,
          pageSize: ps,
          pageCount: pc,
          data: postlist.slice(i, i + ps)
        })
      });
    }

    apiData.push({
      path: 'api/posts.json',
      data: page_posts[0].data
    });

    apiData = apiData.concat(page_posts);

  } else {

    apiData.push({
      path: 'api/posts.json',
      data: JSON.stringify(postlist)
    });
  }

  if (restful.post) {
    apiData = apiData.concat(posts.map(function (post) {
      let path = 'api/articles/' + post.slug + '.json';
      return {
        path: path,
        data: JSON.stringify({
          title: post.title,
          slug: post.slug,
          date: post.date,
          updated: post.updated,
          comments: post.comments,
          path: path,
          excerpt: filterHTMLTags(post.excerpt),
          covers: post.img || fetchCovers(post.content),
          keywords: cfg.keyword,
          content: readMd(post.full_source),
          more: post.more,
          categories: post.categories.map(function (cat) {
            return {
              name: cat.name,
              path: 'api/categories/' + cat.name + '.json'
            };
          }),
          tags: post.tags.map(function (tag) {
            return {
              name: tag.name,
              path: 'api/tags/' + tag.name + '.json'
            };
          })
        })
      };
    }));
  }

  if (restful.pages) {
    apiData = apiData.concat(site.pages.data.map(function (page) {
      let safe_title = page.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()
      let path = 'api/pages/' + safe_title + '.json';
      return {
        path: path,
        data: JSON.stringify({
          title: page.title,
          date: page.date,
          updated: page.updated,
          comments: page.comments,
          path: path,
          covers: page.img || fetchCovers(page.content),
          excerpt: filterHTMLTags(page.excerpt),
          content: readMd(page.full_source)
        })
      };
    }));
  }
  // 轮播图
  if (restful.swipers_list.length !== 0) {
    let swipier = restful.swipers_list
    let res = {
      path: 'api/swiper.json',
      data: []
    }
    swipier.forEach(i => {
      res['data'].push(...postlist.filter(v => v.slug == i))
    })
    apiData = apiData.concat(res)
  }
  if (restful.search_all.enable) {
    let searchConfig = restful.search_all
    let searchfield = searchConfig.field;
    let content = searchConfig.content;
    let posts, pages;
    if (searchfield.trim() == 'post') {
      posts = site.posts.sort('-date');
    } else if (searchfield.trim() == 'page') {
      pages = site.pages;
    } else {
      posts = site.posts.sort('-date');
      pages = site.pages;
    }
    let index = 0
    let res = new Array()
    if (posts) {
      posts.each(function (post) {
        if (post.indexing != undefined && !post.indexing) return;
        let temp_post = new Object()
        if (post.title) {
          temp_post.title = post.title
        }
        if (post.slug) {
          temp_post.slug = post.slug
        }
        if (post.path) {
          temp_post.url = hexo.config.root + post.path
        }
        if (content != false && post._content) {
          temp_post.content = post._content
        }
        if (post.tags && post.tags.length > 0) {
          let tags = [];
          post.tags.forEach(function (tag) {
            tags.push(tag.name);
          });
          temp_post.tags = tags
        }
        if (post.categories && post.categories.length > 0) {
          let categories = [];
          post.categories.forEach(function (cate) {
            categories.push(cate.name);
          });
          temp_post.categories = categories
        }
        res[index] = temp_post;
        index += 1;
      })
    }
    if (pages) {
      pages.each(function (page) {
        if (page.indexing != undefined && !page.indexing) return;
        let temp_page = new Object()
        if (page.title) {
          temp_page.title = page.title
        }
        if (page.slug) {
          temp_page.slug = page.slug
        }
        if (page.path) {
          temp_page.url = hexo.config.root + page.path
        }
        if (content != false && page._content) {
          temp_page.content = page._content
        }
        if (page.tags && page.tags.length > 0) {
          let tags = new Array()
          let tag_index = 0
          page.tags.each(function (tag) {
            tags[tag_index] = tag.name;
          });
          temp_page.tags = tags
        }
        if (page.categories && page.categories.length > 0) {
          temp_page.categories = []
            (page.categories.each || page.categories.forEach)(function (item) {
              temp_page.categories.push(item);
            });
        }
        res[index] = temp_page;
        index += 1;
      });
    }
    let json = {
      path: searchConfig.path,
      data: res
    };
    apiData = apiData.concat(json)
  }

  return apiData;
};
