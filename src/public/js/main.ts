let $feed: any = undefined;
let $filter: any = undefined;
let activeFilters: string[] = [];

const Feed = {
  init() {
    $feed = document.querySelector(".card_list");
    $filter = document.querySelector(".page_filter");
    this.listenFilterChange();
  },

  listenFilterChange() {
    $filter.addEventListener("change", ( event: any ) => {
      activeFilters = <string[]>$(".selectpicker").val();
      activeFilters = activeFilters.map((item: string) => item.replace(/(\s)/g, "").toLowerCase());
      this.update();
    }, false);
  },

  update() {
    $feed.querySelectorAll(".card").forEach((item: any) => {
      if (activeFilters.length === 0) {
        item.classList.remove("hide");
        return;
      }
      if (!~activeFilters.indexOf(item.dataset.type)) {
        item.classList.add("hide");
      } else if (item.classList.contains("hide")) {
        item.classList.remove("hide");
      }
    });
  }
};

$(document).ready(function() {
  $("body").on("click", function (e) {
    $("#form_subscribe").hide();
  });

  $("._open_form").on("click", function (e) {
    e.preventDefault();
    e.stopPropagation();

    $("#form_subscribe").toggle();
  });

  $("#form_subscribe").on("click", function (e) {
    e.stopPropagation();
  });

  const checkboxes = $("._subscribe_checkbox");
  checkboxes.change(function () {
    $("._subscribe_btn").prop("disabled", checkboxes.filter(":checked").length < 1);
  });
  checkboxes.change();


  $(function() {
    const form = $(".form_subscribe");
    const formMessages = $(".form_messages");

    $(form).submit(function(event) {
      event.preventDefault();

      const formData = $(form).serialize();

        $.ajax({
        type: "POST",
        url: $(form).attr("action"),
        data: formData
      }).done(function(response) {
        $(formMessages).removeClass("error");
        $(formMessages).addClass("success");

        if (response.status === "success") {
          $(formMessages).text("Successfully subscribed to future alerts");
        }

        $("#email").val("");
      }).fail(function(data) {
        $(formMessages).removeClass("success");
        $(formMessages).addClass("error");
        $(formMessages).text("An error occurred while subscribing, please try again");
        });
    });
  });

  Feed.init();
});