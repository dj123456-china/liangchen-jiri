/* 在核心页面渲染前进行 Flex gap 行为检测；旧内核保留 margin 基线。 */
(function () {
  var probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px;';
  probe.appendChild(document.createElement('div'));
  probe.appendChild(document.createElement('div'));
  document.body.appendChild(probe);
  if (probe.scrollHeight === 1) document.documentElement.classList.remove('no-flex-gap');
  probe.parentNode.removeChild(probe);
})();
