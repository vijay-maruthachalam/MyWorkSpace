/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright 2014 Adobe Systems Incorporated
 * All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Adobe Systems Incorporated and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Adobe Systems Incorporated and its
 * suppliers and may be covered by U.S. and Foreign Patents,
 * patents in process, and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe Systems Incorporated.
 */
(function(window, document, $, Granite) {
    "use strict";

    //var COMMAND_URL= Granite.HTTP.externalize("/bin/wcmcommand");
    var COMMAND_URL= Granite.HTTP.externalize("/bin/cloneservlet"); //Custom servlet to clone the pages -- OOTB doesn't have clone option
    
    var cloneText;
    function getCloneText() {
        if (!cloneText) {
            cloneText = Granite.I18n.get("Clone");
        }
        return cloneText;
    }
    
    var cancelText;
    function getCancelText() {
        if (!cancelText) {
            cancelText = Granite.I18n.get("Cancel");
        }
        return cancelText;
    }

    function clonePages(collection, paths, force, checkChildren, bulkCloneData) {
        var ui = $(window).adaptTo("foundation-ui");
        ui.wait();

        var url = COMMAND_URL;
        var data = {
            _charset_: "UTF-8",
            force: !!force,
            checkChildren: !!checkChildren
        };
        //if we are in bulk clone mode
        if (bulkCloneData) {
            url = bulkCloneData.sourceParentPath + ".bulkpages.clone";
            Object.assign(data, bulkCloneData);
        } else {
            data.cmd = "clonePage";
            data.path = paths;
        }

        $.ajax({
            url: url,
            type: "POST",
            data: data,
            success: function() {
                ui.clearWait();

                var api = collection.adaptTo("foundation-collection");
                var layoutConfig = collection.data("foundationLayout");

                // In column layout the collection id may represent a preview column belonging to a cloned item.
                if (layoutConfig && layoutConfig.layoutId === "column") {
                    var previewShown = $("coral-columnview-preview").length > 0;

                    if (previewShown) {
                      if (api && "load" in api) {
                        var id = paths[0];

                        if (id) {
                          var parentId = id.substring(0, id.lastIndexOf('/')) || '';

                          if (parentId !== '') {
                            api.load(parentId);
                          }
                        }
                      }
                    }

                    Coral.commons.nextFrame(function() {
                        if (api && "reload" in api) {
                            api.reload();
                        }
                    });

                    return;
                }

                if (api && "reload" in api) {
                    api.reload();
                    return;
                }

                var contentApi = $(".foundation-content").adaptTo("foundation-content");
                if (contentApi) {
                    contentApi.refresh();
                }
            },
            error: function(xhr) {
                ui.clearWait();

                var message = Granite.I18n.getVar($(xhr.responseText).find("#Message").html());

                if (xhr.status === 412) {
                    ui.prompt(getCloneText(), message, "notice", [{
                        text: getCancelText()
                    }, {
                        text: Granite.I18n.get("Force Clone"),
                        warning: true,
                        handler: function() {
                            clonePages(collection, paths, true, false, bulkCloneData);
                        }
                    }]);
                    return;
                }

                ui.alert(Granite.I18n.get("Error"), message, "error");
            }
        });
    }
    
    function createEl(name) {
        return $(document.createElement(name));
    }

    function getbulkCloneData(config, collection) {
        var bulkCloneData;
        var exceptPath = [];
        if (config && config.activeSelectionCount === "bulk") {
            if (collection && collection.dataset.foundationSelectionsSelectallMode === "true") {
                var $collection = $(collection);
                var paginationAPI = $collection.adaptTo("foundation-collection").getPagination();
                if (paginationAPI && paginationAPI.hasNext) {
                    $collection.find(".foundation-collection-item:not(.foundation-selections-item)").each(function() {
                        var itemPath = this.dataset.foundationCollectionItemId;
                        if (itemPath) {
                            exceptPath.push(itemPath);
                        }
                    });
                    bulkCloneData = {
                        sourceParentPath: collection.dataset.foundationCollectionId,
                        exceptPath: exceptPath
                    };
                }
            }
        }
        return bulkCloneData;
    }

    $(window).adaptTo("foundation-registry").register("foundation.collection.action.action", {
        name: "cq.wcm.clone",
        handler: function(name, el, config, collection, selections) {
            var bulkCloneData = getbulkCloneData(config, collection);

            var message = createEl("div");
            var intro = createEl("p").appendTo(message);
            if (selections.length === 1) {
                intro.text(Granite.I18n.get("You are going to clone the following item:"));
            } else if (bulkCloneData) {
                intro.text(Granite.I18n.get("You are going to clone all items from {0} path:",
                    bulkCloneData.sourceParentPath));
            } else {
                intro.text(Granite.I18n.get("You are going to clone the following {0} items:", selections.length));
            }

            var list = [];
            var maxCount = Math.min(selections.length, 12);
            for (var i = 0, ln = maxCount; i < ln; i++) {
                var title = $(selections[i]).find(".foundation-collection-item-title").text();
                list.push(createEl("b").text(title).prop("outerHTML"));
            }
            if (selections.length > maxCount) {
                list.push("&#8230;"); // &#8230; is ellipsis
            }

            createEl("p").html(list.join("<br>")).appendTo(message);

            var ui = $(window).adaptTo("foundation-ui");
            
            ui.prompt(getCloneText(), message.html(), "notice", [{
                text: getCancelText()
            }, {
                text: getCloneText(),
                warning: true,
                handler: function() {
                    var paths = selections.map(function(v) {
                        return $(v).data("foundationCollectionItemId");
                    });

                    clonePages($(collection), paths, false, true, bulkCloneData);
                }
            }]);
        }
    });
})(window, document, Granite.$, Granite);
