## 这个项目是做什么的？

这个是在[hexo-generator-wxapi](https://github.com/Rr210/hexo-generator-wxapi)项目的基础上针对自己的实际需求修改了一部分源码。这是修改前的[源文件](https://github.com/Rr210/hexo-generator-wxapi/blob/master/lib/generator.js)。
> [hexo-generator-wxapi](https://github.com/Rr210/hexo-generator-wxapi)是一款生成hexo-Api接口的npm包，基于[hexo-generator-restful](https://github.com/yscoder/hexo-generator-restful)。

## 为什么要修改

由于想将[我的博客](https://blog-aok.pages.dev/)迁移到微信小程序上，但以前没有接触过小程序的开发，只是看过小程序的一些文档，所以决定在网上找轮子，最终找到了[hexo-wx-api](https://github.com/Rr210/hexo-wx-api)，一款基于hexo框架的微信小程序。通过配置hexo插件生成json数据接口，就可以将博客内容通过接口请求到微信小程序进行展示。
但是使用后发现有几点功能对于我来说不够完善：

1. 文章封面图取文章里面的第一张图片，但有时候文章里并没有图片，或者图片并不适用于封面图。
2. 小程序请求数据后需要将/articles/xx.json中的content字段进行富文本解析展示，否则并不美观。刚开始使用的是[html2wxml](https://github.com/qwqoffice/html2wxml)来解析内容，效果也不错，但是面临一个问题：
> 插件版本解析服务是由 `QwqOffice` 完成，存在不稳定因素，如对稳定性有很高的要求，请自行搭建解析服务，或在自家服务器上直接完成解析。对于有关插件版本不能使用/不能解析的提问，不作任何回答

这是README中的一段介绍，也就是说使用这个插件进行富文本解析时，实际上依赖于他们的接口`https://html2wxml.qwqoffice.com/api/`，通过请求这个接口将数据处理后返回在进行解析，万一这个接口不再提供服务或者崩了，小程序也就跟着出问题了。作者也考虑到了这个问题，将PHP版的解析服务的源码放到了项目中，可以自己部署解析服务，详见[服务端用法](https://github.com/qwqoffice/html2wxml#%E6%9C%8D%E5%8A%A1%E7%AB%AF%E7%94%A8%E6%B3%95)，还有Java版的解析服务,基于JFinal+Jsoup+FastJson，这是[项目地址](https://gitee.com/909854136/html2wxml4J)。但是这需要有自己的服务器，对于白嫖党来说花钱是不可能花钱的，所以决定使用[towxml](https://github.com/sbfkcel/towxml)代替[html2wxml](https://github.com/qwqoffice/html2wxml)来解析富文本。
官方介绍[towxml](https://github.com/sbfkcel/towxml)是微信小程序HTML、Markdown渲染库，不止是html，markdown也可以渲染。当使用[hexo-generator-wxapi](https://github.com/Rr210/hexo-generator-wxapi)生成json文件时，其中的content字段使用的是hexo的`post.content`来生成的，[hexo文档-变量](https://hexo.io/zh-cn/docs/variables)里介绍`page.content`为页面的完整内容，即是hexo编译后的html源码，当使用[towxml](https://github.com/sbfkcel/towxml)来解析html时，里面的代码块展示为1行，非常影响阅读体验。所以决定将content字段替换为markdown源码，而非html。
**以上便是为什么要去修改源码的原因**

## 都修改了哪些地方？

1. 增加了`readMd()`函数，使用nodejs同步读取markdown文件的数据并处理md中不需要的内容

```js
let fs = require("fs")
function readMd(source){
  let data = fs.readFileSync(source, 'utf8')
  let firstDashIndex = data.indexOf('---')
  let secondDashIndex = data.indexOf('---', firstDashIndex + 1)
  return data.substring(secondDashIndex + 3)
}
```
其中参数source使用的是hexo的`post.full_source(页面的完整原始路径)`

2. 我的博客使用的是[hexo-theme-matery](https://github.com/blinkfox/hexo-theme-matery)主题，markdown里面都会有一个img属性来指定文章的封面，将covers指定为post.img
```js
// ...
cover: posts_props('cover', post.img || post.cover || fetchCover(post.content))
// ...
covers: post.img || fetchCovers(post.content)
// ...
covers: page.img || fetchCovers(page.content)
```

3. 取消more字段的展示
```js
// more: post.more
```
