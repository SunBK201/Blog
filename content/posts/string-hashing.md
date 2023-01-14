---
title: "String Hashing 如何工作？"
date: 2021-06-15
draft: false
---

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/20210614002954.png)

字符串哈希是一种将字符串转换为哈希数字的技术。我们为什么需要这样做？有时我们需要比较超长字符串，此时我们可以比较生成的哈希，而不是比较字符串，从而提升效率。

假设你需要比较下面的两个字符串：
```js
const A = "imagine that this is a string of 200 characters"
const B = "imagine that this is a string of 200 characterz"
```
假设两个字符串都有 200 个字符。一个暴力的方法是依次比较每个字符，看它们是否匹配。像下面这样：
```js
const A = "imagine that this is a string of 200 characters"

const B = "imagine that this is a string of 200 characterz"

function equal(A, B) {
  let i;
  for(i = 0; i < A.length; i++){
    if (A[i] !== B[i]) {
      return false;
    }
  }
  return true;
}

console.log(equal(A,B));
```

对于超长字符串来说，这并不是最佳选择，因为它的性能是 O(min(A, B))。

当然，我们可以通过添加一个比较 A 大小和 B 大小的条件来使其成为 O(n)。像下面这样：

```js
function equal(A, B) {
  if (A.lenght !== B.length) return false;
  let i;
  for(i = 0; i < A.length; i++){
    if (A[i] !== B[i]) {
      return false;
    }
  }
  return true;
}
```

正如我所说，最坏的情况是 O(n)，但在实际生产环境中，我们需要比较一个真正的超长字符串。

字符串哈希可以将我们的字符串转换成一个整数，这将作为一个哈希数字。因此，我们比较两个哈希值 `hash(A)==hash(B)` ，性能会是 O(1)。这是我们比较两个字符串的最佳选择。

# String Hash 公式

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/20210617170827.png)

我们规定 p 和 m 是素数，s[0], s[1], s[2]… 是每个字符的值，在这里是字符编码。

p: 素数，大致等于所使用的不同字符的数量。例如，如果我们要计算一个只包括英文小写字母的单词的哈希值，31 会是个不错的数字。然而，如果我们还会使用大写字母的话，那么 53 是一个合适的选择。

m: 这个数字越大，两个随机字符串出现碰撞的概率就越小。这个变量也应该是素数。

10 ^ 9 + 9 是个常用的选择。

比如我们使用下面一组：
```js
p = 31
m = 1e9 + 9
word = 'apple'
```
我们想要得到 apple 的哈希，因此我们使用 String Hash 公式：

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/20210617170855.png)

进一步：

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/20210617171007.png)

字符编码为：
```js
"a" = 97
"p" = 112
"p" = 112
"l" = 108
"e" = 101
```
在公式中进行替换：

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/20210617171156.png)

然后我们化简得到公式：

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/20210617171227.png)

最终：

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/20210617171249.png)

我们最终得到 apple 的哈希为 96604250。

以下是 JavaScript 的实现：
```js
function hash(word) {
  var p = 31;
  var m = 1e9 + 9;
  var hash_value = 0;
  for(var i = 0; i < word.length; i++) {
      var letter = word[i];
      var charCode = letter.charCodeAt();
      hash_value = hash_value + (charCode * Math.pow(p, i))
  }
  return hash_value % m;
}

console.log(hash("apple"));
```

This is a version from [Jorge Chávez](https://jorgechavez.dev/).