/*global MAPJS, Color, $, _*/
/*jslint nomen: true, newcap: true, browser: true*/

MAPJS.domMediator = function (mapModel, stageElement) {
	'use strict';

	var connectorKey = function (connectorObj) {
			return 'connector_' + connectorObj.from + '_' + connectorObj.to;
		},
		horizontalConnector = function (parentX, parentY, parentWidth, parentHeight,
				childX, childY, childWidth, childHeight) {
			var childHorizontalOffset = parentX < childX ? 0.1 : 0.9,
				parentHorizontalOffset = 1 - childHorizontalOffset;
			return {
				from: {
					x: parentX + parentHorizontalOffset * parentWidth,
					y: parentY + 0.5 * parentHeight
				},
				to: {
					x: childX + childHorizontalOffset * childWidth,
					y: childY + 0.5 * childHeight
				},
				controlPointOffset: 0
			};
		},
		calculateConnector = function (parent, child) {
			return calculateConnectorInner(parent.position().left, parent.position().top, parent.width(), parent.height(),
				child.position().left, child.position().top, child.width(), child.height());
		},

		calculateConnectorInner = _.memoize(function (parentX, parentY, parentWidth, parentHeight,
				childX, childY, childWidth, childHeight) {
			var tolerance = 10,
				childMid = childY + childHeight * 0.5,
				parentMid = parentY + parentHeight * 0.5,
				childHorizontalOffset;
			if (Math.abs(parentMid - childMid) + tolerance < Math.max(childHeight, parentHeight * 0.75)) {
				return horizontalConnector(parentX, parentY, parentWidth, parentHeight, childX, childY, childWidth, childHeight);
			}
			childHorizontalOffset = parentX < childX ? 0 : 1;
			return {
				from: {
					x: parentX + 0.5 * parentWidth,
					y: parentY + 0.5 * parentHeight
				},
				to: {
					x: childX + childHorizontalOffset * childWidth,
					y: childY + 0.5 * childHeight
				},
				controlPointOffset: 0.75
			};
		}, function () {
			return Array.prototype.join.call(arguments, ',');
		});

	mapModel.addEventListener('nodeSelectionChanged', function (ideaId, isSelected) {
		var node = $('#node_' + ideaId);
		if (isSelected) {
//			node.addClass('selected');
			node.focus();
		} else {
//			node.removeClass('selected');
		}
	});
	mapModel.addEventListener('nodeRemoved', function (node) {
		$('#node_' + node.id).remove();
	});
	mapModel.addEventListener('connectorCreated', function (connector) {
		var	shapeFrom = $('#node_' + connector.from),
			shapeTo = $('#node_' + connector.to),
			config = {
				stroke: '#888',
				width: 1
			},
			domConnector,
			svg = function (tag) {
				return document.createElementNS('http://www.w3.org/2000/svg', tag);
			},
			calculatedConnector = calculateConnector(shapeFrom, shapeTo),
			from = calculatedConnector.from,
			to = calculatedConnector.to,
			position = {
				left: Math.min(shapeFrom.position().left, shapeTo.position().left),
				top: Math.min(shapeFrom.position().top, shapeTo.position().top),
			},
			offset = calculatedConnector.controlPointOffset * (from.y - to.y),
			maxOffset = Math.min(shapeTo.height(), shapeFrom.height()) * 1.5,
			straightLine = false;


		position.width = Math.max(shapeFrom.position().left + shapeFrom.width(), shapeTo.position().left + shapeTo.width(), position.left + 1) - position.left;
		position.height = Math.max(shapeFrom.position().top + shapeFrom.height(), shapeTo.position().top + shapeTo.height(), position.top + 1) - position.top;
		domConnector = $(svg('svg')).attr(position);
		if (straightLine) {
			$(svg('line')).attr({
				x1: from.x - position.left,
				x2: to.x - position.left,
				y1: from.y - position.top,
				y2: to.y - position.top,
				style: 'stroke:' + config.stroke + ';stroke-width:' + config.width + 'px'
			}).appendTo(domConnector);
		} else {
			offset = Math.max(-maxOffset, Math.min(maxOffset, offset));
			$(svg('path')).attr('d',
				'M' + (from.x - position.left) + ',' + (from.y - position.top) +
				'Q' + (from.x - position.left) + ',' + (to.y - offset - position.top) + ' ' + (to.x - position.left) + ',' + (to.y - position.top)
			).attr({
				fill: 'none',
				stroke: config.stroke,
				'stroke-width': config.width
			}).appendTo(domConnector);
		}
		domConnector.attr('id', connectorKey(connector)).css(position).addClass('connector').appendTo(stageElement);
	});
	mapModel.addEventListener('connectorRemoved', function (connector) {
		$('#' + connectorKey(connector)).remove();
	});
	mapModel.addEventListener('nodeCreated', function (node) {
		var config = {
				padding: '8px'
			},
			backgroundColor = function () {
				var fromStyle =	node.attr && node.attr.style && node.attr.style.background,
					generic = MAPJS.defaultStyles[node.level === 1 ? 'root' : 'nonRoot'].background;
				return fromStyle ||  generic;
			},
			foregroundColor = function (backgroundColor) {
				var tintedBackground = Color(backgroundColor).mix(Color('#EEEEEE')).hexString();
				return MAPJS.contrastForeground(tintedBackground);
			},
			nodeDiv = $('<div>')
				.attr('tabindex', 0)
				.attr('id', 'node_' + node.id)
				.addClass('node')
				.css({
				'left': node.x + stageElement.innerWidth() / 2,
				'top': node.y + stageElement.innerHeight() / 2,
				'width': node.width,
				'height': node.height,
				'background-color': backgroundColor()
			}).appendTo(stageElement),
			textBox = $('<span>').addClass('text').text(node.title).appendTo(nodeDiv).css({
				color: foregroundColor(backgroundColor()),
				display: 'block'
			}),
			icon;
		if (node.attr && node.attr.icon) {
			icon = document.createElement('img');
			icon.src = node.attr.icon.url;
			icon.width = node.attr.icon.width;
			icon.height = node.attr.icon.height;

			if (node.attr.icon.position === 'top') {
				$(icon).css({
					'display': 'block',
					'margin-left': (node.width - icon.width) / 2,
					'margin-top': config.padding
				}).prependTo(nodeDiv);
				textBox.css({
					'display': 'block',
					'width': '100%',
					'margin-top': config.padding
				});
				nodeDiv.css('text-align', 'center');
			} else {
				nodeDiv.prepend(icon);
			}
		}
		else {
			textBox.css({
				'margin-top': (node.height - textBox.outerHeight(true)) / 2,
				'margin-left': (node.width - textBox.outerWidth(true)) / 2
			});

		}
	});
};
$.fn.domMapWidget = function (activityLog, mapModel) {
	'use strict';
	var hotkeyEventHandlers = {
			'return': 'addSiblingIdea',
			'shift+return': 'addSiblingIdeaBefore',
			'del backspace': 'removeSubIdea',
			'tab insert': 'addSubIdea',
			'left': 'selectNodeLeft',
			'up': 'selectNodeUp',
			'right': 'selectNodeRight',
			'shift+right': 'activateNodeRight',
			'shift+left': 'activateNodeLeft',
			'shift+up': 'activateNodeUp',
			'shift+down': 'activateNodeDown',
			'down': 'selectNodeDown',
			'space f2': 'editNode',
			'f': 'toggleCollapse',
			'c meta+x ctrl+x': 'cut',
			'p meta+v ctrl+v': 'paste',
			'y meta+c ctrl+c': 'copy',
			'u meta+z ctrl+z': 'undo',
			'shift+tab': 'insertIntermediate',
			'Esc 0 meta+0 ctrl+0': 'resetView',
			'r meta+shift+z ctrl+shift+z meta+y ctrl+y': 'redo',
			'meta+plus ctrl+plus z': 'scaleUp',
			'meta+minus ctrl+minus shift+z': 'scaleDown',
			'meta+up ctrl+up': 'moveUp',
			'meta+down ctrl+down': 'moveDown',
			'ctrl+shift+v meta+shift+v': 'pasteStyle',
			'Esc': 'cancelCurrentAction'
		},
		charEventHandlers = {
			'[' : 'activateChildren',
			'{'	: 'activateNodeAndChildren',
			'='	: 'activateSiblingNodes',
			'.'	: 'activateSelectedNode',
			'/' : 'toggleCollapse',
			'a' : 'openAttachment',
			'i' : 'editIcon'
		},
		actOnKeys = true;
	mapModel.addEventListener('inputEnabledChanged', function (canInput) {
		actOnKeys = canInput;
	});

	return this.each(function () {
		var element = $(this);
		MAPJS.domMediator(mapModel, element);
		_.each(hotkeyEventHandlers, function (mappedFunction, keysPressed) {
			element.keydown(keysPressed, function (event) {
				if (actOnKeys) {
					event.preventDefault();
					mapModel[mappedFunction]('keyboard');
				}
			});
		});
		element.on('keypress', function (evt) {
			if (!actOnKeys) {
				return;
			}
			if (/INPUT|TEXTAREA/.test(evt && evt.target && evt.target.tagName)) {
				return;
			}
			var unicode = evt.charCode || evt.keyCode,
				actualkey = String.fromCharCode(unicode),
				mappedFunction = charEventHandlers[actualkey];
			if (mappedFunction) {
				evt.preventDefault();
				mapModel[mappedFunction]('keyboard');
			} else if (Number(actualkey) <= 9 && Number(actualkey) >= 1) {
				evt.preventDefault();
				mapModel.activateLevel('keyboard', Number(actualkey) + 1);
			}
		});
	});
};

// + shadows
// + selected
// + default and non default backgrounds for root and children
// + multi-line text
//
// focus or selected?
// drag * drop
// drag background
// icon position
// custom connectors
// attachment - clip
// straight lines extension
// collaboration avatars
// folded
// activated
// zoom
// mouse events
// mapwidget keyboard bindings
// mapwidget mouse bindings
// hyperlinks
// remaining kinetic mediator events
// -	mapModel.addEventListener('addLinkModeToggled', function (isOn) {
// -	mapModel.addEventListener('nodeEditRequested', function (nodeId, shouldSelectAll, editingNew) {
// +	mapModel.addEventListener('nodeCreated', function (n) {
// -	mapModel.addEventListener('nodeSelectionChanged', function (ideaId, isSelected) {
// -	mapModel.addEventListener('nodeFocusRequested', function (ideaId)  {
// -	mapModel.addEventListener('nodeAttrChanged', function (n) {
// -	mapModel.addEventListener('nodeDroppableChanged', function (ideaId, isDroppable) {
// +	mapModel.addEventListener('nodeRemoved', function (n) {
// -	mapModel.addEventListener('nodeMoved', function (n, reason) {
// -	mapModel.addEventListener('nodeTitleChanged', function (n) {
// +	mapModel.addEventListener('connectorCreated', function (n) {
// -	mapModel.addEventListener('layoutChangeComplete', function () {
// -	mapModel.addEventListener('connectorRemoved', function (n) {
// -	mapModel.addEventListener('linkCreated', function (l) {
// -	mapModel.addEventListener('linkRemoved', function (l) {
// -	mapModel.addEventListener('linkAttrChanged', function (l) {
// -	mapModel.addEventListener('mapScaleChanged', function (scaleMultiplier, zoomPoint) {
// -	mapModel.addEventListener('mapViewResetRequested', function () {
// -	mapModel.addEventListener('mapMoveRequested', function (deltaX, deltaY) {
// -	mapModel.addEventListener('activatedNodesChanged', function (activatedNodes, deactivatedNodes) {
// animations
// - node removed
// no more memoization on calc connector - not needed
