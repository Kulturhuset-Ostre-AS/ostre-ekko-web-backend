<?php
/**
 * Ekko module for Craft CMS 3.x
 *
 * Custom functionality for Ekko site
 *
 * @link      http://pauliusfriedt.com
 * @copyright Copyright (c) 2020 Paulius Friedt
 */

namespace modules\ekkomodule\services;

use modules\ekkomodule\EkkoModule;

use Craft;
use craft\base\Component;
use craft\elements\Entry;

/**
 * Ekko Service
 *
 * All of your module’s business logic should go in services, including saving data,
 * retrieving data, etc. They provide APIs that your controllers, template variables,
 * and other modules can interact with.
 *
 * https://craftcms.com/docs/plugins/services
 *
 * @author    Paulius Friedt
 * @package   EkkoModule
 * @since     1.0.0
 */
class EkkoService extends Component
{
    // Public Methods
    // =========================================================================

    /**
     * This function can literally be anything you want, and you can have as many service
     * functions as you want
     *
     * From any other plugin/module file, call it like this:
     *
     *     EkkoModule::$instance->ekko->exampleService()
     *
     * @return mixed
     */
    // public function exampleService()
    // {
    //     $result = 'something';

    //     return $result;
    // }

    /*
	 * Get artist entries related to an event through performance entries
	 *
	 * return ElementModelCriteria
	 */
    public function getEventArtists($performances) {
        return Entry::find()
            ->section('artists')
            ->relatedTo([
                'sourceElement' => $performances->ids(),
                'field' => 'artist'
            ]);
    }

    public function getEventPerformances($event, $field) {
        return Entry::find()
            ->section('performance')
            ->relatedTo([
                'sourceElement' => $event->id,
                'field' => $field
            ])
            ->orderBy([
                "DATE(`content`.`field_date`)" => SORT_ASC, 
                "(CASE LEFT(TIME(`content`.`field_time`), 2) WHEN '00' THEN '25' WHEN '01' THEN '26' WHEN '02' THEN '27' WHEN '03' THEN '28' ELSE LEFT(TIME(`content`.`field_time`), 2) END)"  => SORT_ASC,
                "(RIGHT(TIME(`content`.`field_time`), 2))" => SORT_ASC
            ]);
    }
}
